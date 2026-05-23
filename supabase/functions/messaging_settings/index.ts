import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  assertOrgAdministrator,
  getMessagingSettingsPublic,
  getMessagingSettingsSecrets,
  upsertMessagingSettings,
} from "../_shared/messagingSettings.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { sendTwilioSms } from "../_shared/twilio.ts";
import { normalizeUsPhoneToE164 } from "../_shared/phone.ts";

type SettingsBody = {
  action?: "get" | "update" | "test_sms";
  twilio_account_sid?: string | null;
  twilio_auth_token?: string | null;
  twilio_phone_number?: string | null;
  sms_enabled?: boolean;
  business_hours?: Record<
    string,
    { open?: string | null; close?: string | null; closed?: boolean }
  > | null;
  out_of_hours_message?: string | null;
  auto_acknowledge_enabled?: boolean;
  auto_acknowledge_message?: string | null;
  test_phone?: string | null;
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

        if (action === "test_sms") {
          await assertOrgAdministrator(user, orgId);
          const settings = await getMessagingSettingsSecrets(orgId);
          if (!settings?.sms_enabled) {
            throw new Error("SMS is not enabled");
          }
          const accountSid = settings.twilio_account_sid?.trim();
          const authToken = settings.twilio_auth_token?.trim();
          const fromNumber = settings.twilio_phone_number?.trim();
          const toNumber = normalizeUsPhoneToE164(
            body.test_phone?.trim() ?? "",
          );
          if (!accountSid || !authToken || !fromNumber || !toNumber) {
            throw new Error(
              "Twilio credentials or test phone number are missing",
            );
          }
          await sendTwilioSms({
            accountSid,
            authToken,
            from: fromNumber,
            to: toNumber,
            body: "Nomi CRM test SMS — your Twilio integration is working.",
          });
          return new Response(JSON.stringify({ ok: true }), {
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
          business_hours: body.business_hours ?? undefined,
          out_of_hours_message: body.out_of_hours_message ?? undefined,
          auto_acknowledge_enabled: body.auto_acknowledge_enabled ?? undefined,
          auto_acknowledge_message: body.auto_acknowledge_message ?? undefined,
        });

        return new Response(JSON.stringify(settings), {
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
