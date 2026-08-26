import { supabaseAdmin } from "./supabaseAdmin.ts";
import {
  getMessagingSettingsSecrets,
  type MessagingSettingsPublic,
} from "./messagingSettings.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";

const getPgcryptoKey = () => Deno.env.get("PGCRYPTO_KEY")?.trim() ?? "";

const getSupabaseFunctionsBase = () => {
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/functions/v1`;
};

export type VoiceSettingsPublic = {
  voice_enabled: boolean;
  voice_twiml_app_sid: string | null;
  voice_api_key_sid: string | null;
  has_voice_api_key_secret: boolean;
  voice_caller_id: string | null;
  voice_recording_default: boolean;
  voice_twiml_url: string | null;
  voice_status_webhook_url: string | null;
  voice_inbound_url: string | null;
};

export type VoiceSettingsSecrets = {
  org_id: number;
  messaging_provider: "twilio" | "telnyx";
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_phone_number: string | null;
  voice_enabled: boolean;
  voice_twiml_app_sid: string | null;
  voice_api_key_sid: string | null;
  voice_api_key_secret: string | null;
  voice_caller_id: string | null;
  voice_recording_default: boolean;
  telnyx_api_key: string | null;
  telnyx_phone_number: string | null;
  telnyx_telephony_credential_id: string | null;
  telnyx_sip_username: string | null;
  telnyx_sip_password: string | null;
  telnyx_caller_id: string | null;
};

const resolveVoiceApiKeySecret = async (
  orgId: number,
  encrypted: string | null | undefined,
) => {
  if (!encrypted?.trim()) return null;
  const key = getPgcryptoKey();
  if (!key) {
    throw new Error(
      "PGCRYPTO_KEY is not configured for Voice API key decryption",
    );
  }
  const { data, error } = await supabaseAdmin.rpc("get_voice_api_key_secret", {
    p_org_id: orgId,
    p_key: key,
  });
  if (error) {
    throw new Error(error.message ?? "Failed to decrypt Voice API key secret");
  }
  return typeof data === "string" && data.trim() ? data.trim() : null;
};

export const getVoiceWebhookUrls = () => {
  const base = getSupabaseFunctionsBase();
  if (!base) {
    return {
      voice_twiml_url: null,
      voice_status_webhook_url: null,
      voice_inbound_url: null,
    };
  }
  return {
    voice_twiml_url: `${base}/voice_twiml`,
    voice_status_webhook_url: `${base}/voice_status_webhook`,
    voice_inbound_url: `${base}/voice_inbound`,
  };
};

export const getVoiceSettingsPublicFromRow = (
  row: Record<string, unknown> | null | undefined,
): VoiceSettingsPublic => {
  const urls = getVoiceWebhookUrls();
  return {
    voice_enabled: row?.voice_enabled === true,
    voice_twiml_app_sid:
      typeof row?.voice_twiml_app_sid === "string"
        ? row.voice_twiml_app_sid
        : null,
    voice_api_key_sid:
      typeof row?.voice_api_key_sid === "string" ? row.voice_api_key_sid : null,
    has_voice_api_key_secret: Boolean(
      typeof row?.voice_api_key_secret_encrypted === "string" &&
        row.voice_api_key_secret_encrypted.trim(),
    ),
    voice_caller_id:
      typeof row?.voice_caller_id === "string" ? row.voice_caller_id : null,
    voice_recording_default: row?.voice_recording_default === true,
    ...urls,
  };
};

export async function getVoiceSettingsSecrets(
  orgId: number,
): Promise<VoiceSettingsSecrets | null> {
  const { data, error } = await supabaseAdmin
    .from("organization_messaging_settings")
    .select(
      "org_id, twilio_account_sid, twilio_auth_token, twilio_auth_token_encrypted, twilio_phone_number, voice_enabled, voice_twiml_app_sid, voice_api_key_sid, voice_api_key_secret_encrypted, voice_caller_id, voice_recording_default",
    )
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load voice settings");
  }
  if (!data) return null;

  const smsSecrets = await getMessagingSettingsSecrets(orgId);

  const apiKeySecret = await resolveVoiceApiKeySecret(
    orgId,
    data.voice_api_key_secret_encrypted,
  );

  return {
    org_id: orgId,
    messaging_provider:
      smsSecrets?.messaging_provider === "telnyx" ? "telnyx" : "twilio",
    twilio_account_sid:
      smsSecrets?.twilio_account_sid ?? data.twilio_account_sid ?? null,
    twilio_auth_token: smsSecrets?.twilio_auth_token ?? null,
    twilio_phone_number:
      smsSecrets?.twilio_phone_number ?? data.twilio_phone_number ?? null,
    voice_enabled: data.voice_enabled === true,
    voice_twiml_app_sid: data.voice_twiml_app_sid ?? null,
    voice_api_key_sid: data.voice_api_key_sid ?? null,
    voice_api_key_secret: apiKeySecret,
    voice_caller_id: data.voice_caller_id ?? null,
    voice_recording_default: data.voice_recording_default === true,
    telnyx_api_key: smsSecrets?.telnyx_api_key ?? null,
    telnyx_phone_number: smsSecrets?.telnyx_phone_number ?? null,
    telnyx_telephony_credential_id:
      smsSecrets?.telnyx_telephony_credential_id ?? null,
    telnyx_sip_username: smsSecrets?.telnyx_sip_username ?? null,
    telnyx_sip_password: smsSecrets?.telnyx_sip_password ?? null,
    telnyx_caller_id: smsSecrets?.telnyx_caller_id ?? null,
  };
}

export async function findOrgVoiceSettingsByTwimlAppSid(applicationSid: string) {
  const trimmed = applicationSid.trim();
  if (!trimmed) return null;

  const { data, error } = await supabaseAdmin
    .from("organization_messaging_settings")
    .select("*")
    .eq("voice_twiml_app_sid", trimmed)
    .eq("voice_enabled", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to resolve voice settings");
  }

  if (!data?.org_id) return null;
  return getVoiceSettingsSecrets(Number(data.org_id));
}

/** Browser dialer token — Twilio API key or Telnyx WebRTC credentials. */
export function assertVoiceTokenConfigured(
  settings: VoiceSettingsSecrets | null,
): asserts settings is VoiceSettingsSecrets {
  if (!settings?.voice_enabled) {
    throw new Error(
      "Voice calling is not enabled. Turn it on in Settings → Connectors.",
    );
  }

  if (settings.messaging_provider === "telnyx") {
    const apiKey = settings.telnyx_api_key?.trim();
    const telephonyId = settings.telnyx_telephony_credential_id?.trim();
    const sipUser = settings.telnyx_sip_username?.trim();
    const sipPass = settings.telnyx_sip_password?.trim();
    const callerId =
      settings.telnyx_caller_id?.trim() ||
      settings.telnyx_phone_number?.trim() ||
      settings.voice_caller_id?.trim();
    if (!apiKey && !(sipUser && sipPass)) {
      throw new Error(
        "Telnyx API key or SIP username/password is required for voice.",
      );
    }
    if (!telephonyId && !(sipUser && sipPass)) {
      throw new Error(
        "Telnyx Telephony Credential ID or SIP username/password is required for voice.",
      );
    }
    if (!callerId) {
      throw new Error("Outbound caller ID is required for Telnyx voice");
    }
    return;
  }

  const accountSid = settings.twilio_account_sid?.trim();
  const twimlAppSid = settings.voice_twiml_app_sid?.trim();
  const apiKeySid = settings.voice_api_key_sid?.trim();
  const apiKeySecret = settings.voice_api_key_secret?.trim();
  const callerId =
    settings.voice_caller_id?.trim() || settings.twilio_phone_number?.trim();

  if (!accountSid) {
    throw new Error(
      "Twilio Account SID is missing. Re-save Twilio SMS settings in Settings → Connectors, then try again.",
    );
  }
  if (!twimlAppSid) {
    throw new Error("TwiML App SID is required for voice");
  }
  if (!apiKeySid || !apiKeySecret) {
    throw new Error("Twilio API Key SID and secret are required for voice");
  }
  if (!callerId) {
    throw new Error("Outbound caller ID is required for voice");
  }
}

/** TwiML webhooks — needs Auth Token for signature validation (Twilio only). */
export function assertVoiceConfigured(
  settings: VoiceSettingsSecrets | null,
): asserts settings is VoiceSettingsSecrets {
  assertVoiceTokenConfigured(settings);
  if (settings.messaging_provider === "telnyx") return;
  const authToken = settings.twilio_auth_token?.trim();
  if (!authToken) {
    throw new Error(
      "Twilio Auth Token is missing. Re-save your Auth Token in Settings → Connectors.",
    );
  }
}

export const resolveOutboundCallerId = (settings: VoiceSettingsSecrets) => {
  const callerId =
    settings.messaging_provider === "telnyx"
      ? settings.telnyx_caller_id?.trim() ||
        settings.telnyx_phone_number?.trim() ||
        settings.voice_caller_id?.trim()
      : settings.voice_caller_id?.trim() || settings.twilio_phone_number?.trim();
  const normalized = callerId ? normalizeUsPhoneToE164(callerId) : null;
  return normalized ?? callerId ?? null;
};
