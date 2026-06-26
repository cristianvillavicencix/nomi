import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberVoiceCallCapability } from "../_shared/memberModulePermissions.ts";
import {
  assertVoiceTokenConfigured,
  getVoiceSettingsSecrets,
} from "../_shared/voiceSettings.ts";
import { createTwilioVoiceAccessToken } from "../_shared/twilioAccessToken.ts";

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

        const token = await createTwilioVoiceAccessToken({
          accountSid: settings!.twilio_account_sid!.trim(),
          apiKeySid: settings!.voice_api_key_sid!.trim(),
          apiKeySecret: settings!.voice_api_key_secret!.trim(),
          twimlAppSid: settings!.voice_twiml_app_sid!.trim(),
          identity: `member-${member.org_id}-${member.id}`,
        });

        return new Response(
          JSON.stringify({
            token,
            identity: `member-${member.org_id}-${member.id}`,
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
