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
import {
  assertAllowedOrgEmailAddress,
  resolveOrgGeneralFrom,
} from "../_shared/organizationEmailSenders.ts";
import { getTicketInboundSetup } from "../_shared/ticketInboundSetup.ts";

type EmailSettingsBody = {
  action?: "get" | "update" | "test";
  /** General sender (portal, meetings). Alias: reply_to. */
  reply_to?: string | null;
  general_from_email?: string | null;
  billing_from_email?: string | null;
  general_email_enabled?: boolean;
  billing_email_enabled?: boolean;
  ticket_inbox_email?: string | null;
  ticket_inbox_enabled?: boolean;
  test_email?: string | null;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OrgEmailRow = {
  id: number;
  name: string | null;
  email: string | null;
  billing_from_email?: string | null;
  general_email_enabled?: boolean | null;
  billing_email_enabled?: boolean | null;
};

const loadOrgEmailRow = async (orgId: number): Promise<OrgEmailRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select(
      "id, name, email, billing_from_email, general_email_enabled, billing_email_enabled",
    )
    .eq("id", orgId)
    .maybeSingle();

  if (
    error?.message?.includes("billing_from_email") ||
    error?.message?.includes("general_email_enabled") ||
    error?.message?.includes("billing_email_enabled") ||
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
    .select(
      "email, billing_from_email, general_email_enabled, billing_email_enabled",
    )
    .eq("id", orgId)
    .maybeSingle();

  if (
    error?.message?.includes("billing_from_email") ||
    error?.message?.includes("general_email_enabled") ||
    error?.message?.includes("billing_email_enabled") ||
    error?.message?.includes("column")
  ) {
    const { data: fallback, error: fallbackError } = await supabaseAdmin
      .from("organizations")
      .select("email")
      .eq("id", orgId)
      .maybeSingle();
    if (fallbackError) throw new Error(fallbackError.message);
    return {
      email: fallback?.email ?? null,
      billing_from_email: null,
      general_email_enabled: true,
      billing_email_enabled: true,
    };
  }

  if (error) throw new Error(error.message);
  return {
    email: data?.email ?? null,
    billing_from_email: data?.billing_from_email ?? null,
    general_email_enabled: data?.general_email_enabled !== false,
    billing_email_enabled: data?.billing_email_enabled !== false,
  };
};

const isProvided = <T>(value: T | undefined): value is T => value !== undefined;

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
          const ticket_inbound = member?.administrator === true
            ? await getTicketInboundSetup(orgId)
            : null;

          return {
            configured: status.configured,
            provider: status.provider,
            from_email: status.general_from_email ?? status.from_email,
            general_from_email: status.general_from_email ?? status.from_email,
            billing_from_email: status.billing_from_email,
            general_email_enabled: freshOrg.general_email_enabled,
            billing_email_enabled: freshOrg.billing_email_enabled,
            reply_to: freshOrg.email?.trim() ?? null,
            billing_from: freshOrg.billing_from_email?.trim() ?? null,
            org_name: org.name ?? null,
            uses_messaging_credentials: status.uses_messaging_credentials,
            ticket_inbound,
          };
        };

        if (action === "get") {
          const status = await buildStatus();
          return new Response(JSON.stringify(status), {
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
            emailChannel: "general",
          });

          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action !== "update") {
          return createErrorResponse(400, "Invalid action");
        }

        const emailUpdate: Record<string, string | boolean | null> = {};

        if (
          isProvided(body.general_from_email) ||
          isProvided(body.reply_to)
        ) {
          const raw = (body.general_from_email ?? body.reply_to ?? "").trim();
          emailUpdate.email = raw
            ? assertAllowedOrgEmailAddress(raw, "General sender")
            : null;
        }

        if (isProvided(body.billing_from_email)) {
          const raw = body.billing_from_email?.trim() ?? "";
          emailUpdate.billing_from_email = raw
            ? assertAllowedOrgEmailAddress(raw, "Billing sender")
            : null;
        }

        if (isProvided(body.general_email_enabled)) {
          emailUpdate.general_email_enabled = body.general_email_enabled === true;
        }

        if (isProvided(body.billing_email_enabled)) {
          emailUpdate.billing_email_enabled = body.billing_email_enabled === true;
        }

        if (Object.keys(emailUpdate).length > 0) {
          const fullUpdate = await supabaseAdmin
            .from("organizations")
            .update(emailUpdate)
            .eq("id", orgId)
            .select(
              "email, billing_from_email, general_email_enabled, billing_email_enabled",
            )
            .single();

          if (
            fullUpdate.error?.message?.includes("billing_from_email") ||
            fullUpdate.error?.message?.includes("general_email_enabled") ||
            fullUpdate.error?.message?.includes("billing_email_enabled") ||
            (fullUpdate.error?.message?.includes("column") &&
              fullUpdate.error.message.includes("does not exist"))
          ) {
            const legacyUpdate: Record<string, string | null> = {};
            if ("email" in emailUpdate) {
              legacyUpdate.email = emailUpdate.email as string | null;
            }
            if (Object.keys(legacyUpdate).length > 0) {
              const emailOnlyUpdate = await supabaseAdmin
                .from("organizations")
                .update(legacyUpdate)
                .eq("id", orgId)
                .select("email")
                .single();
              if (emailOnlyUpdate.error) {
                throw new Error(
                  emailOnlyUpdate.error.message ??
                    "Could not save email settings",
                );
              }
            }
          } else if (fullUpdate.error) {
            throw new Error(
              fullUpdate.error.message ?? "Could not save email settings",
            );
          }
        }

        if (
          isProvided(body.ticket_inbox_email) ||
          isProvided(body.ticket_inbox_enabled)
        ) {
          const setup = await getTicketInboundSetup(orgId);
          if (!setup?.inbox_id) {
            throw new Error("No ticket inbox configured");
          }

          const inboxUpdate: Record<string, string | boolean> = {};
          if (isProvided(body.ticket_inbox_email)) {
            const raw = body.ticket_inbox_email?.trim() ?? "";
            if (!raw) {
              throw new Error("Ticket inbox address is required");
            }
            inboxUpdate.email = assertAllowedOrgEmailAddress(
              raw,
              "Ticket inbox address",
            );
          }
          if (isProvided(body.ticket_inbox_enabled)) {
            inboxUpdate.is_active = body.ticket_inbox_enabled === true;
          }

          const { error: inboxError } = await supabaseAdmin
            .from("ticket_inboxes")
            .update(inboxUpdate)
            .eq("id", setup.inbox_id)
            .eq("org_id", orgId);

          if (inboxError) {
            throw new Error(
              inboxError.message ?? "Could not save ticket inbox settings",
            );
          }
        }

        return new Response(JSON.stringify(await buildStatus()), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Request failed";
        return createErrorResponse(400, message);
      }
    });
  }),
);
