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

type EmailSettingsBody = {
  action?: "get" | "update" | "test";
  reply_to?: string | null;
  test_email?: string | null;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id, name, email")
          .eq("id", orgId)
          .maybeSingle();

        const buildStatus = async (replyTo?: string | null) => {
          const status = await getOrgTransactionalEmailStatus(orgId);
          return {
            configured: status.configured,
            provider: status.provider,
            from_email: status.from_email,
            reply_to: replyTo ?? org?.email?.trim() ?? null,
            org_name: org?.name ?? null,
            uses_messaging_credentials: status.uses_messaging_credentials,
          };
        };

        if (action === "get") {
          return new Response(JSON.stringify(await buildStatus()), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        await assertOrgAdministrator(user, orgId);

        if (action === "test") {
          const to = body.test_email?.trim().toLowerCase() ?? "";
          if (!to || !emailRegex.test(to)) {
            return createErrorResponse(400, "Enter a valid test email address");
          }

          await sendTransactionalEmail({
            orgId,
            orgName: org?.name ?? null,
            to,
            subject: "Nomi CRM test email",
            textBody:
              "Your transactional email integration is working.\n\nThis message was sent from Settings → Communications.",
            replyTo: org?.email?.trim() ?? null,
          });

          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action !== "update") {
          return createErrorResponse(400, "Invalid action");
        }

        const replyTo = body.reply_to?.trim() ?? "";
        if (replyTo && !emailRegex.test(replyTo)) {
          return createErrorResponse(400, "Enter a valid reply-to email");
        }

        const { data: updated, error } = await supabaseAdmin
          .from("organizations")
          .update({ email: replyTo || null })
          .eq("id", orgId)
          .select("email")
          .single();

        if (error) {
          throw new Error(error.message ?? "Could not save reply-to email");
        }

        return new Response(
          JSON.stringify(await buildStatus(updated?.email?.trim() ?? null)),
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
