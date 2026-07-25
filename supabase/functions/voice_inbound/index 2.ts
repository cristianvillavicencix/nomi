import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { validateTwilioSignatureForVoiceWebhook } from "../_shared/twilio.ts";
import {
  buildInboundDialClientsTwiml,
  buildTwimlSayAndHangup,
  parseTwilioFormBody,
} from "../_shared/twilioVoice.ts";
import { getVoiceWebhookUrls } from "../_shared/voiceSettings.ts";
import {
  findOrgVoiceSettingsByInboundNumber,
  listInboundVoiceClientIdentities,
} from "../_shared/voiceInbound.ts";
import { upsertVoiceCallFromTwilioStatus } from "../_shared/voiceCallSync.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { normalizeUsPhoneToE164 } from "../_shared/phone.ts";

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
    const calledNumber =
      params.To?.trim() ||
      params.Called?.trim() ||
      params.called?.trim() ||
      "";
    if (!calledNumber) {
      console.error("[voice_inbound] missing called number", params);
      return twimlResponse(
        buildTwimlSayAndHangup("This number is not configured for voice."),
      );
    }

    const settings = await findOrgVoiceSettingsByInboundNumber(calledNumber);
    const authToken = settings?.twilio_auth_token?.trim();
    if (!settings || !authToken) {
      console.error("[voice_inbound] voice not configured", { calledNumber });
      return twimlResponse(
        buildTwimlSayAndHangup("Voice is not configured for this number."),
      );
    }

    const signature = req.headers.get("X-Twilio-Signature");
    const valid = await validateTwilioSignatureForVoiceWebhook(
      authToken,
      signature,
      req,
      params,
      "voice_inbound",
    );
    if (!valid) {
      console.error("[voice_inbound] invalid signature", {
        calledNumber,
        callSid: params.CallSid,
      });
      return twimlResponse(
        buildTwimlSayAndHangup("Could not verify this call request."),
      );
    }

    const { voice_status_webhook_url: statusCallbackUrl } = getVoiceWebhookUrls();
    if (!statusCallbackUrl) {
      return twimlResponse(
        buildTwimlSayAndHangup("Voice status callback is not configured."),
      );
    }

    const inboundParams = { ...params };
    if (inboundParams.From) {
      inboundParams.From =
        normalizeUsPhoneToE164(inboundParams.From) ?? inboundParams.From;
    }
    if (inboundParams.To) {
      inboundParams.To =
        normalizeUsPhoneToE164(inboundParams.To) ?? inboundParams.To;
    }

    try {
      await upsertVoiceCallFromTwilioStatus(
        supabaseAdmin,
        inboundParams,
        settings.org_id,
      );
    } catch (syncError) {
      console.error("[voice_inbound] call log sync failed", syncError);
    }

    const clientIdentities = await listInboundVoiceClientIdentities(
      settings.org_id,
    );

    console.info("[voice_inbound] routing", {
      callSid: params.CallSid,
      from: inboundParams.From,
      to: calledNumber,
      orgId: settings.org_id,
      clients: clientIdentities.length,
    });

    const twiml = buildInboundDialClientsTwiml({
      clientIdentities,
      statusCallbackUrl,
    });

    return twimlResponse(twiml);
  } catch (error) {
    console.error("[voice_inbound] error", error);
    return twimlResponse(
      buildTwimlSayAndHangup("An unexpected error occurred."),
    );
  }
});
