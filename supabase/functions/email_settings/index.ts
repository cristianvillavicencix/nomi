import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { assertOrgAdministrator } from "../_shared/messagingSettings.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  getOrgTransactionalEmailStatus,
  sendTransactionalEmail,
} from "../_shared/transactionalEmail.ts";
import { resolveOrgGeneralFrom } from "../_shared/organizationEmailSenders.ts";
import { getTicketInboundSetup } from "../_shared/ticketInboundSetup.ts";

type EmailSettingsBody = {
  action?: "get" | "update" | "test";
  /** General sender (portal, meetings). Alias: reply_to. */
  reply_to?: string | null;
  general_from_email?: string | null;
  billing_from_email?: string | null;
  test_email?: string | null;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OrgEmailRow = {
  id: number;
  name: string | null;
  email: string | null;
  billing_from_email?: string | null;
};

const loadOrgEmailRow = async (orgId: number): Promise<OrgEmailRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("id, name, email, billing_from_email")
    .eq("id", orgId)
    .maybeSingle();

  if (
    error?.message?.includes("billing_from_email") ||
    error?.message?.includes("column")
  ) {
    const { data: fallback, error: fallbackError } = await supabaseAdmin
      .from("organizations")
      .select("id, name, email")
      .eq("id", orgId)
      .maybeSingle();
    if (fallbackError) throw new Error(fallbackError.message);
    return fallback;
  }

  if (error) throw new Error(error.message);
  return data;
};

const loadOrgEmailFields = async (orgId: number) => {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("email, billing_from_email")
    .eq("id", orgId)
    .maybeSingle();

  if (
    error?.message?.includes("billing_from_email") ||
    error?.message?.includes("column")
  ) {
    const { data: fallback, error: fallbackError } = await supabaseAdmin
      .from("organizations")
      .select("email")
      .eq("id", orgId)
      .maybeSingle();
    if (fallbackError) throw new Error(fallbackError.message);
    return { email: fallback?.email ?? null, billing_from_email: null };
  }

  if (error) throw new Error(error.message);
  return {
    email: data?.email ?? null,
    billing_from_email: data?.billing_from_email ?? null,
  };
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      const member = await getUserOrganizationMember(user);
      const orgId = member?.org_id != null ? Number(member.org_id) : null;
      if (!orgId) {
        return createErrorResponse(403, "Organization not found");
      }

      try {
        const body = (await req.json().catch(() => ({}))) as EmailSettingsBody;
        const action = body.action ?? "get";

        const org = await loadOrgEmailRow(orgId);
        if (!org) {
          return createErrorResponse(403, "Organization not found");
        }

        const buildStatus = async () => {
          const status = await getOrgTransactionalEmailStatus(orgId);
          const freshOrg = await loadOrgEmailFields(orgId);

          return {
            configured: status.configured,
            provider: status.provider,
            from_email: status.general_from_email ?? status.from_email,
            general_from_email: status.general_from_email ?? status.from_email,
            billing_from_email: status.billing_from_email,
            reply_to: freshOrg.email?.trim() ?? null,
            billing_from: freshOrg.billing_from_email?.trim() ?? null,
            org_name: org.name ?? null,
            uses_messaging_credentials: status.uses_messaging_credentials,
          };
        };

        if (action === "get") {
          const status = await buildStatus();
          const isAdmin = member?.administrator === true;
          const ticket_inbound = isAdmin
            ? await getTicketInboundSetup(orgId)
            : null;
          return new Response(JSON.stringify({ ...status, ticket_inbound }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        await assertOrgAdministrator(user, orgId);

        if (action === "test") {
          const to = body.test_email?.trim().toLowerCase() ?? "";
          if (!to || !emailRegex.test(to)) {
            return createErrorResponse(400, "Enter a valid test email address");
          }

          const generalFrom = await resolveOrgGeneralFrom(orgId, org.name ?? null);
          await sendTransactionalEmail({
            orgId,
            orgName: org.name ?? null,
            to,
            subject: "Latino Business Support test email",
            textBody:
              "Your system email integration is working.\n\nThis message was sent from Settings → Integrations.",
            fromEmail: generalFrom.email,
            fromName: generalFrom.name,
            replyTo: generalFrom.email,
          });

          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action !== "update") {
          return createErrorResponse(400, "Invalid action");
        }

        const generalFromEmail = (
          body.general_from_email ??
          body.reply_to ??
          ""
        ).trim();
        const billingFromEmail = (body.billing_from_email ?? "").trim();

        if (generalFromEmail && !emailRegex.test(generalFromEmail)) {
          return createErrorResponse(400, "Enter a valid general sender email");
        }
        if (billingFromEmail && !emailRegex.test(billingFromEmail)) {
          return createErrorResponse(400, "Enter a valid billing sender email");
        }

        const emailUpdate: { email: string | null; billing_from_email?: string | null } =
          { email: generalFromEmail || null };
        if (billingFromEmail) {
          emailUpdate.billing_from_email = billingFromEmail;
        } else {
          emailUpdate.billing_from_email = null;
        }

        let updated: { email: string | null; billing_from_email?: string | null } | null =
          null;

        const fullUpdate = await supabaseAdmin
          .from("organizations")
          .update(emailUpdate)
          .eq("id", orgId)
          .select("email, billing_from_email")
          .single();

        updated = fullUpdate.data;
        const updateError = fullUpdate.error;

        if (
          updateError?.message?.includes("billing_from_email") ||
          (updateError?.message?.includes("column") &&
            updateError.message.includes("does not exist"))
        ) {
          const emailOnlyUpdate = await supabaseAdmin
            .from("organizations")
            .update({ email: generalFromEmail || null })
            .eq("id", orgId)
            .select("email")
            .single();
          if (emailOnlyUpdate.error) {
            throw new Error(
              emailOnlyUpdate.error.message ?? "Could not save email settings",
            );
          }
          updated = {
            email: emailOnlyUpdate.data?.email ?? null,
            billing_from_email: null,
          };
        } else if (updateError) {
          throw new Error(updateError.message ?? "Could not save email settings");
        }

        return new Response(
          JSON.stringify(await buildStatus()),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Request failed";
        return createErrorResponse(400, message);
      }
    });
  }),
);
