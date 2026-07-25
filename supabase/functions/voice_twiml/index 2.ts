import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { validateTwilioSignatureForVoiceWebhook } from "../_shared/twilio.ts";
import {
  buildOutboundDialTwiml,
  buildTwimlSayAndHangup,
  parseTwilioFormBody,
  resolveOutboundDestination,
} from "../_shared/twilioVoice.ts";
import {
  findOrgVoiceSettingsByTwimlAppSid,
  resolveOutboundCallerId,
} from "../_shared/voiceSettings.ts";
import { normalizeUsPhoneToE164 } from "../_shared/phone.ts";
import { getVoiceWebhookUrls } from "../_shared/voiceSettings.ts";
import { upsertVoiceCallFromTwilioStatus } from "../_shared/voiceCallSync.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const twimlResponse = (twiml: string, status = 200) =>
  new Response(twiml, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/xml; charset=utf-8",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return twimlResponse(buildTwimlSayAndHangup("Method not allowed"), 405);
  }

  try {
    const params = await parseTwilioFormBody(req);
    const applicationSid = params.ApplicationSid?.trim();
    if (!applicationSid) {
      console.error("[voice_twiml] missing ApplicationSid", params);
      return twimlResponse(
        buildTwimlSayAndHangup("Voice application is not configured."),
      );
    }

    const settings = await findOrgVoiceSettingsByTwimlAppSid(applicationSid);
    const authToken = settings?.twilio_auth_token?.trim();
    if (!settings || !authToken) {
      console.error("[voice_twiml] voice not configured", { applicationSid });
      return twimlResponse(
        buildTwimlSayAndHangup(
          "Voice is not configured. Check Nomi settings and Twilio auth token.",
        ),
      );
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
      console.error("[voice_twiml] invalid signature", {
        applicationSid,
        callSid: params.CallSid,
      });
      return twimlResponse(
        buildTwimlSayAndHangup("Could not verify this call request."),
      );
    }

    const rawTo = resolveOutboundDestination(params);
    const toNumber = rawTo ? normalizeUsPhoneToE164(rawTo) ?? rawTo : null;
    if (!toNumber) {
      console.error("[voice_twiml] missing destination", {
        callSid: params.CallSid,
        keys: Object.keys(params),
      });
      return twimlResponse(
        buildTwimlSayAndHangup("No destination phone number was provided."),
      );
    }

    const callerId = resolveOutboundCallerId(settings);
    if (!callerId) {
      return twimlResponse(
        buildTwimlSayAndHangup("Outbound caller ID is not configured."),
      );
    }

    const { voice_status_webhook_url: statusCallbackUrl } = getVoiceWebhookUrls();
    if (!statusCallbackUrl) {
      return twimlResponse(
        buildTwimlSayAndHangup("Voice status callback is not configured."),
      );
    }

    try {
      await upsertVoiceCallFromTwilioStatus(
        supabaseAdmin,
        params,
        settings.org_id,
      );
    } catch (syncError) {
      console.error("[voice_twiml] call log sync failed", syncError);
    }

    const twiml = buildOutboundDialTwiml({
      to: toNumber,
      callerId,
      statusCallbackUrl,
      record: settings.voice_recording_default,
    });

    console.info("[voice_twiml] dialing", {
      callSid: params.CallSid,
      to: toNumber,
      callerId,
      orgId: settings.org_id,
    });

    return twimlResponse(twiml);
  } catch (error) {
    console.error("[voice_twiml] error", error);
    return twimlResponse(
      buildTwimlSayAndHangup("An unexpected error occurred starting the call."),
    );
  }
});
