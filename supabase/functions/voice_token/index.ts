import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import twilio from "npm:twilio@5.5.1";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import {
  assertVoiceConfigured,
  getVoiceSettingsSecrets,
} from "../_shared/voiceSettings.ts";

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

        if (
          !member.administrator &&
          !hasMemberCapability(member, "voice.calls.make")
        ) {
          return createErrorResponse(403, "You cannot place calls");
        }

        const settings = await getVoiceSettingsSecrets(Number(member.org_id));
        try {
          assertVoiceConfigured(settings);
        } catch (error) {
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error ? error.message : "Voice not configured",
              code: "VOICE_NOT_CONFIGURED",
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        const accountSid = settings!.twilio_account_sid!.trim();
        const apiKeySid = settings!.voice_api_key_sid!.trim();
        const apiKeySecret = settings!.voice_api_key_secret!.trim();
        const twimlAppSid = settings!.voice_twiml_app_sid!.trim();
        const identity = `member-${member.org_id}-${member.id}`;

        const token = new twilio.jwt.AccessToken(
          accountSid,
          apiKeySid,
          apiKeySecret,
          { identity, ttl: 3600 },
        );

        const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
          outgoingApplicationSid: twimlAppSid,
          incomingAllow: false,
        });
        token.addGrant(voiceGrant);

        return new Response(
          JSON.stringify({
            token: token.toJwt(),
            identity,
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
