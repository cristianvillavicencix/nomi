import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  assertOrgAdministrator,
  getMessagingSettingsPublic,
  upsertMessagingSettings,
} from "../_shared/messagingSettings.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";

type SettingsBody = {
  action?: "get" | "update";
  twilio_account_sid?: string | null;
  twilio_auth_token?: string | null;
  twilio_phone_number?: string | null;
  sms_enabled?: boolean;
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
        const body = (await req.json().catch(() => ({}))) as SettingsBody;
        const action = body.action ?? "get";

        if (action === "get") {
          const settings = await getMessagingSettingsPublic(orgId);
          return new Response(JSON.stringify(settings), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action !== "update") {
          return createErrorResponse(400, "Invalid action");
        }

        await assertOrgAdministrator(user, orgId);

        const settings = await upsertMessagingSettings(orgId, {
          twilio_account_sid: body.twilio_account_sid ?? null,
          twilio_auth_token: body.twilio_auth_token ?? null,
          twilio_phone_number: body.twilio_phone_number ?? null,
          sms_enabled: body.sms_enabled === true,
          keepExistingToken: !body.twilio_auth_token?.trim(),
        });

        return new Response(JSON.stringify(settings), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed";
        return createErrorResponse(400, message);
      }
    });
  }),
);
