import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberVoiceCallCapability } from "../_shared/memberModulePermissions.ts";
import {
  assertVoiceTokenConfigured,
  getVoiceSettingsSecrets,
  resolveOutboundCallerId,
} from "../_shared/voiceSettings.ts";
import { createTwilioVoiceAccessToken } from "../_shared/twilioAccessToken.ts";
import { createTelnyxTelephonyCredentialToken } from "../_shared/telnyx.ts";

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (_req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      try {
        const member = await getUserOrganizationMember(user);
        if (!member?.id || !member.org_id) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (!hasMemberVoiceCallCapability(member)) {
          return createErrorResponse(403, "You cannot place calls");
        }

        const settings = await getVoiceSettingsSecrets(Number(member.org_id));
        try {
          assertVoiceTokenConfigured(settings);
        } catch (error) {
          return createErrorResponse(
            503,
            error instanceof Error ? error.message : "Voice not configured",
            { code: "VOICE_NOT_CONFIGURED" },
          );
        }

        const identity = `member-${member.org_id}-${member.id}`;
        const callerId = resolveOutboundCallerId(settings!);

        if (settings!.messaging_provider === "telnyx") {
          const apiKey = settings!.telnyx_api_key?.trim();
          const telephonyId = settings!.telnyx_telephony_credential_id?.trim();
          const sipUser = settings!.telnyx_sip_username?.trim();
          const sipPass = settings!.telnyx_sip_password?.trim();

          if (telephonyId && apiKey) {
            const token = await createTelnyxTelephonyCredentialToken({
              apiKey,
              telephonyCredentialId: telephonyId,
            });
            return new Response(
              JSON.stringify({
                provider: "telnyx",
                token,
                identity,
                caller_id: callerId,
              }),
              {
                headers: { "Content-Type": "application/json", ...corsHeaders },
              },
            );
          }

          if (sipUser && sipPass) {
            return new Response(
              JSON.stringify({
                provider: "telnyx",
                token: "",
                login: sipUser,
                password: sipPass,
                identity,
                caller_id: callerId,
              }),
              {
                headers: { "Content-Type": "application/json", ...corsHeaders },
              },
            );
          }

          return createErrorResponse(
            503,
            "Telnyx voice credentials are incomplete",
            { code: "VOICE_NOT_CONFIGURED" },
          );
        }

        const token = await createTwilioVoiceAccessToken({
          accountSid: settings!.twilio_account_sid!.trim(),
          apiKeySid: settings!.voice_api_key_sid!.trim(),
          apiKeySecret: settings!.voice_api_key_secret!.trim(),
          twimlAppSid: settings!.voice_twiml_app_sid!.trim(),
          identity,
        });

        return new Response(
          JSON.stringify({
            provider: "twilio",
            token,
            identity,
            caller_id: callerId,
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      } catch (error) {
        console.error("[voice_token] error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
