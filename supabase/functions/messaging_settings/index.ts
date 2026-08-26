import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  assertOrgAdministrator,
  getMessagingSettingsPublic,
  upsertMessagingSettings,
  type MessagingProvider,
} from "../_shared/messagingSettings.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { sendOrgSms } from "../_shared/sendOrgSms.ts";
import { normalizeUsPhoneToE164 } from "../_shared/phone.ts";

type SettingsBody = {
  action?: "get" | "update" | "test_sms";
  messaging_provider?: MessagingProvider;
  twilio_account_sid?: string | null;
  twilio_auth_token?: string | null;
  twilio_phone_number?: string | null;
  sms_enabled?: boolean;
  telnyx_api_key?: string | null;
  telnyx_phone_number?: string | null;
  telnyx_messaging_profile_id?: string | null;
  telnyx_sip_connection_id?: string | null;
  telnyx_telephony_credential_id?: string | null;
  telnyx_sip_username?: string | null;
  telnyx_sip_password?: string | null;
  telnyx_caller_id?: string | null;
  business_hours?: Record<
    string,
    { open?: string | null; close?: string | null; closed?: boolean }
  > | null;
  out_of_hours_message?: string | null;
  auto_acknowledge_enabled?: boolean;
  auto_acknowledge_message?: string | null;
  voice_api_key_secret?: string | null;
  keepExistingVoiceApiKeySecret?: boolean;
  voice_caller_id?: string | null;
  voice_recording_default?: boolean;
  voice_enabled?: boolean;
  voice_twiml_app_sid?: string | null;
  voice_api_key_sid?: string | null;
  test_phone?: string | null;
  twilio_marketing_messaging_service_sid?: string | null;
  twilio_marketing_phone_number?: string | null;
  marketing_email_from?: string | null;
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
          const toNumber = normalizeUsPhoneToE164(
            body.test_phone?.trim() ?? "",
          );
          if (!toNumber) {
            throw new Error("Test phone number is missing or invalid");
          }
          await sendOrgSms({
            orgId,
            to: toNumber,
            body: "Sigma by Latino Business Support test SMS — your messaging integration is working.",
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
          ...(body.messaging_provider !== undefined
            ? { messaging_provider: body.messaging_provider }
            : {}),
          ...(body.twilio_account_sid !== undefined
            ? { twilio_account_sid: body.twilio_account_sid }
            : {}),
          ...(body.twilio_auth_token !== undefined
            ? {
                twilio_auth_token: body.twilio_auth_token,
                keepExistingToken: !body.twilio_auth_token?.trim(),
              }
            : {}),
          ...(body.twilio_phone_number !== undefined
            ? { twilio_phone_number: body.twilio_phone_number }
            : {}),
          ...(body.telnyx_api_key !== undefined
            ? {
                telnyx_api_key: body.telnyx_api_key,
                keepExistingTelnyxApiKey: !body.telnyx_api_key?.trim(),
              }
            : {}),
          ...(body.telnyx_phone_number !== undefined
            ? { telnyx_phone_number: body.telnyx_phone_number }
            : {}),
          ...(body.telnyx_messaging_profile_id !== undefined
            ? { telnyx_messaging_profile_id: body.telnyx_messaging_profile_id }
            : {}),
          ...(body.telnyx_sip_connection_id !== undefined
            ? { telnyx_sip_connection_id: body.telnyx_sip_connection_id }
            : {}),
          ...(body.telnyx_telephony_credential_id !== undefined
            ? {
                telnyx_telephony_credential_id:
                  body.telnyx_telephony_credential_id,
              }
            : {}),
          ...(body.telnyx_sip_username !== undefined
            ? { telnyx_sip_username: body.telnyx_sip_username }
            : {}),
          ...(body.telnyx_sip_password !== undefined
            ? {
                telnyx_sip_password: body.telnyx_sip_password,
                keepExistingTelnyxSipPassword: !body.telnyx_sip_password?.trim(),
              }
            : {}),
          ...(body.telnyx_caller_id !== undefined
            ? { telnyx_caller_id: body.telnyx_caller_id }
            : {}),
          ...(body.sms_enabled !== undefined
            ? { sms_enabled: body.sms_enabled === true }
            : {}),
          ...(body.business_hours !== undefined
            ? { business_hours: body.business_hours }
            : {}),
          ...(body.out_of_hours_message !== undefined
            ? { out_of_hours_message: body.out_of_hours_message }
            : {}),
          ...(body.auto_acknowledge_enabled !== undefined
            ? { auto_acknowledge_enabled: body.auto_acknowledge_enabled }
            : {}),
          ...(body.auto_acknowledge_message !== undefined
            ? { auto_acknowledge_message: body.auto_acknowledge_message }
            : {}),
          ...(body.voice_enabled !== undefined
            ? { voice_enabled: body.voice_enabled === true }
            : {}),
          ...(body.voice_twiml_app_sid !== undefined
            ? { voice_twiml_app_sid: body.voice_twiml_app_sid }
            : {}),
          ...(body.voice_api_key_sid !== undefined
            ? { voice_api_key_sid: body.voice_api_key_sid }
            : {}),
          ...(body.voice_api_key_secret !== undefined
            ? {
                voice_api_key_secret: body.voice_api_key_secret,
                keepExistingVoiceApiKeySecret:
                  !body.voice_api_key_secret?.trim(),
              }
            : {}),
          ...(body.voice_caller_id !== undefined
            ? { voice_caller_id: body.voice_caller_id }
            : {}),
          ...(body.voice_recording_default !== undefined
            ? { voice_recording_default: body.voice_recording_default === true }
            : {}),
          ...(body.twilio_marketing_messaging_service_sid !== undefined
            ? {
                twilio_marketing_messaging_service_sid:
                  body.twilio_marketing_messaging_service_sid,
              }
            : {}),
          ...(body.twilio_marketing_phone_number !== undefined
            ? {
                twilio_marketing_phone_number:
                  body.twilio_marketing_phone_number,
              }
            : {}),
          ...(body.marketing_email_from !== undefined
            ? { marketing_email_from: body.marketing_email_from }
            : {}),
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
