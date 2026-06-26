import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { validateTwilioSignatureForVoiceWebhook } from "../_shared/twilio.ts";
import { parseTwilioFormBody } from "../_shared/twilioVoice.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { upsertVoiceCallFromTwilioStatus } from "../_shared/voiceCallSync.ts";
import { normalizeUsPhoneToE164 } from "../_shared/phone.ts";

const findOrgByAccountSid = async (accountSid: string) => {
  const { data, error } = await supabaseAdmin
    .from("organization_messaging_settings")
    .select("org_id, twilio_auth_token, twilio_auth_token_encrypted, twilio_account_sid, voice_enabled")
    .eq("twilio_account_sid", accountSid)
    .eq("voice_enabled", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to resolve organization");
  }
  if (!data?.org_id) return null;

  const { getMessagingSettingsSecrets } = await import(
    "../_shared/messagingSettings.ts"
  );
  const secrets = await getMessagingSettingsSecrets(Number(data.org_id));
  return secrets;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const params = await parseTwilioFormBody(req);
    const accountSid = params.AccountSid?.trim();
    if (!accountSid) {
      return new Response("Missing AccountSid", { status: 400, headers: corsHeaders });
    }

    const settings = await findOrgByAccountSid(accountSid);
    const authToken = settings?.twilio_auth_token?.trim();
    if (!settings || !authToken) {
      return new Response("Voice not configured", {
        status: 404,
        headers: corsHeaders,
      });
    }

    const signature = req.headers.get("X-Twilio-Signature");
    const valid = await validateTwilioSignatureForVoiceWebhook(
      authToken,
      signature,
      req,
      params,
      "voice_status_webhook",
    );
    if (!valid) {
      return new Response("Invalid signature", { status: 403, headers: corsHeaders });
    }

    if (params.To && !params.To.startsWith("client:")) {
      params.To = normalizeUsPhoneToE164(params.To) ?? params.To;
    }
    if (params.From && !params.From.startsWith("client:")) {
      params.From = normalizeUsPhoneToE164(params.From) ?? params.From;
    }

    await upsertVoiceCallFromTwilioStatus(
      supabaseAdmin,
      params,
      settings.org_id,
    );

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("[voice_status_webhook] error", error);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
