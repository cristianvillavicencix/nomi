import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { validateTwilioSignatureForVoiceWebhook } from "../_shared/twilio.ts";
import {
  buildOutboundDialTwiml,
  parseTwilioFormBody,
} from "../_shared/twilioVoice.ts";
import {
  findOrgVoiceSettingsByTwimlAppSid,
  resolveOutboundCallerId,
} from "../_shared/voiceSettings.ts";
import { normalizeUsPhoneToE164 } from "../_shared/phone.ts";
import { getVoiceWebhookUrls } from "../_shared/voiceSettings.ts";
import { upsertVoiceCallFromTwilioStatus } from "../_shared/voiceCallSync.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return createErrorResponse(405, "Method not allowed");
  }

  try {
    const params = await parseTwilioFormBody(req);
    const applicationSid = params.ApplicationSid?.trim();
    if (!applicationSid) {
      return createErrorResponse(400, "Missing ApplicationSid");
    }

    const settings = await findOrgVoiceSettingsByTwimlAppSid(applicationSid);
    const authToken = settings?.twilio_auth_token?.trim();
    if (!settings || !authToken) {
      return createErrorResponse(404, "Voice not configured");
    }

    const signature = req.headers.get("X-Twilio-Signature");
    const valid = await validateTwilioSignatureForVoiceWebhook(
      authToken,
      signature,
      req,
      params,
      "voice_twiml",
    );
    if (!valid) {
      return createErrorResponse(403, "Invalid Twilio signature");
    }

    const rawTo = params.To?.trim();
    const toNumber = rawTo ? normalizeUsPhoneToE164(rawTo) ?? rawTo : null;
    if (!toNumber) {
      return createErrorResponse(400, "Missing destination number");
    }

    const callerId = resolveOutboundCallerId(settings);
    if (!callerId) {
      return createErrorResponse(400, "Caller ID not configured");
    }

    const { voice_status_webhook_url: statusCallbackUrl } = getVoiceWebhookUrls();
    if (!statusCallbackUrl) {
      return createErrorResponse(500, "Voice status callback URL is not configured");
    }

    await upsertVoiceCallFromTwilioStatus(
      supabaseAdmin,
      params,
      settings.org_id,
    );

    const twiml = buildOutboundDialTwiml({
      to: toNumber,
      callerId,
      statusCallbackUrl,
      record: settings.voice_recording_default,
    });

    return new Response(twiml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("[voice_twiml] error", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unexpected error",
    );
  }
});
