import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "./supabaseAdmin.ts";
import { getUserOrganizationMember } from "./getUserOrganizationMember.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";
import {
  getVoiceSettingsPublicFromRow,
  getVoiceWebhookUrls,
  type VoiceSettingsPublic,
} from "./voiceSettings.ts";

export type MessagingProvider = "twilio" | "telnyx";

export type MessagingSettingsPublic = {
  org_id: number;
  messaging_provider: MessagingProvider;
  twilio_account_sid: string | null;
  twilio_phone_number: string | null;
  sms_enabled: boolean;
  has_auth_token: boolean;
  webhook_url: string | null;
  telnyx_phone_number: string | null;
  telnyx_messaging_profile_id: string | null;
  telnyx_sip_connection_id: string | null;
  telnyx_telephony_credential_id: string | null;
  telnyx_sip_username: string | null;
  telnyx_caller_id: string | null;
  has_telnyx_api_key: boolean;
  has_telnyx_sip_password: boolean;
  telnyx_webhook_url: string | null;
  telnyx_status_webhook_url: string | null;
  business_hours?: Record<
    string,
    { open?: string | null; close?: string | null; closed?: boolean }
  > | null;
  out_of_hours_message?: string | null;
  auto_acknowledge_enabled?: boolean;
  auto_acknowledge_message?: string | null;
  twilio_marketing_messaging_service_sid?: string | null;
  twilio_marketing_phone_number?: string | null;
  marketing_email_from?: string | null;
} & VoiceSettingsPublic;

export type MessagingSettingsSecrets = {
  org_id: number;
  messaging_provider: MessagingProvider;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_phone_number: string | null;
  sms_enabled: boolean;
  telnyx_api_key: string | null;
  telnyx_phone_number: string | null;
  telnyx_messaging_profile_id: string | null;
  telnyx_sip_connection_id: string | null;
  telnyx_telephony_credential_id: string | null;
  telnyx_sip_username: string | null;
  telnyx_sip_password: string | null;
  telnyx_caller_id: string | null;
};

const getFunctionsBase = () => {
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  return base ? `${base}/functions/v1` : null;
};

const getWebhookUrl = () => {
  const base = getFunctionsBase();
  return base ? `${base}/twilio_inbound_sms` : null;
};

const getTelnyxWebhookUrl = () => {
  const base = getFunctionsBase();
  return base ? `${base}/telnyx_inbound_sms` : null;
};

const getTelnyxStatusWebhookUrl = () => {
  const base = getFunctionsBase();
  return base ? `${base}/telnyx_sms_status` : null;
};

const getPgcryptoKey = () => Deno.env.get("PGCRYPTO_KEY")?.trim() ?? "";

const normalizeProvider = (value: unknown): MessagingProvider =>
  value === "telnyx" ? "telnyx" : "twilio";

const resolveTwilioAuthToken = async (
  orgId: number,
  row: {
    twilio_auth_token?: string | null;
    twilio_auth_token_encrypted?: string | null;
  },
) => {
  const legacy = row.twilio_auth_token?.trim();
  if (row.twilio_auth_token_encrypted?.trim()) {
    const key = getPgcryptoKey();
    if (!key) {
      throw new Error(
        "PGCRYPTO_KEY is not configured for Twilio token decryption",
      );
    }
    const { data, error } = await supabaseAdmin.rpc("get_twilio_auth_token", {
      p_org_id: orgId,
      p_key: key,
    });
    if (error) {
      throw new Error(error.message ?? "Failed to decrypt Twilio auth token");
    }
    if (typeof data === "string" && data.trim()) {
      return data.trim();
    }
  }
  return legacy ?? null;
};

const resolveTelnyxApiKey = async (orgId: number, encrypted?: string | null) => {
  if (!encrypted?.trim()) return null;
  const key = getPgcryptoKey();
  if (!key) {
    throw new Error("PGCRYPTO_KEY is not configured for Telnyx key decryption");
  }
  const { data, error } = await supabaseAdmin.rpc("get_telnyx_api_key", {
    p_org_id: orgId,
    p_key: key,
  });
  if (error) {
    throw new Error(error.message ?? "Failed to decrypt Telnyx API key");
  }
  return typeof data === "string" && data.trim() ? data.trim() : null;
};

const resolveTelnyxSipPassword = async (
  orgId: number,
  encrypted?: string | null,
) => {
  if (!encrypted?.trim()) return null;
  const key = getPgcryptoKey();
  if (!key) {
    throw new Error(
      "PGCRYPTO_KEY is not configured for Telnyx SIP password decryption",
    );
  }
  const { data, error } = await supabaseAdmin.rpc("get_telnyx_sip_password", {
    p_org_id: orgId,
    p_key: key,
  });
  if (error) {
    throw new Error(error.message ?? "Failed to decrypt Telnyx SIP password");
  }
  return typeof data === "string" && data.trim() ? data.trim() : null;
};

export async function assertOrgAdministrator(user: User, orgId: number) {
  const member = await getUserOrganizationMember(user);
  if (!member?.administrator) {
    throw new Error("Only administrators can manage messaging settings");
  }
  if (Number(member.org_id) !== orgId) {
    throw new Error("Organization mismatch");
  }
  return member;
}

const PUBLIC_SELECT =
  "org_id, messaging_provider, twilio_account_sid, twilio_phone_number, sms_enabled, twilio_auth_token, twilio_auth_token_encrypted, telnyx_api_key_encrypted, telnyx_phone_number, telnyx_messaging_profile_id, telnyx_sip_connection_id, telnyx_telephony_credential_id, telnyx_sip_username, telnyx_sip_password_encrypted, telnyx_caller_id, business_hours, out_of_hours_message, auto_acknowledge_enabled, auto_acknowledge_message, twilio_marketing_messaging_service_sid, twilio_marketing_phone_number, marketing_email_from, voice_enabled, voice_twiml_app_sid, voice_api_key_sid, voice_api_key_secret_encrypted, voice_caller_id, voice_recording_default";

export async function getMessagingSettingsPublic(
  orgId: number,
): Promise<MessagingSettingsPublic> {
  const { data, error } = await supabaseAdmin
    .from("organization_messaging_settings")
    .select(PUBLIC_SELECT)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load messaging settings");
  }

  return {
    org_id: orgId,
    messaging_provider: normalizeProvider(data?.messaging_provider),
    twilio_account_sid: data?.twilio_account_sid ?? null,
    twilio_phone_number: data?.twilio_phone_number ?? null,
    sms_enabled: data?.sms_enabled === true,
    has_auth_token: Boolean(
      data?.twilio_auth_token_encrypted?.trim() ||
        data?.twilio_auth_token?.trim(),
    ),
    webhook_url: getWebhookUrl(),
    telnyx_phone_number: data?.telnyx_phone_number ?? null,
    telnyx_messaging_profile_id: data?.telnyx_messaging_profile_id ?? null,
    telnyx_sip_connection_id: data?.telnyx_sip_connection_id ?? null,
    telnyx_telephony_credential_id:
      data?.telnyx_telephony_credential_id ?? null,
    telnyx_sip_username: data?.telnyx_sip_username ?? null,
    telnyx_caller_id: data?.telnyx_caller_id ?? null,
    has_telnyx_api_key: Boolean(data?.telnyx_api_key_encrypted?.trim()),
    has_telnyx_sip_password: Boolean(
      data?.telnyx_sip_password_encrypted?.trim(),
    ),
    telnyx_webhook_url: getTelnyxWebhookUrl(),
    telnyx_status_webhook_url: getTelnyxStatusWebhookUrl(),
    business_hours:
      (data?.business_hours as MessagingSettingsPublic["business_hours"]) ??
      null,
    out_of_hours_message: data?.out_of_hours_message ?? null,
    auto_acknowledge_enabled: data?.auto_acknowledge_enabled === true,
    auto_acknowledge_message: data?.auto_acknowledge_message ?? null,
    twilio_marketing_messaging_service_sid:
      data?.twilio_marketing_messaging_service_sid ?? null,
    twilio_marketing_phone_number: data?.twilio_marketing_phone_number ?? null,
    marketing_email_from: data?.marketing_email_from ?? null,
    ...getVoiceSettingsPublicFromRow(data),
  };
}

export async function getMessagingSettingsSecrets(
  orgId: number,
): Promise<MessagingSettingsSecrets | null> {
  const { data, error } = await supabaseAdmin
    .from("organization_messaging_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load messaging settings");
  }

  if (!data) return null;

  const authToken = await resolveTwilioAuthToken(orgId, data);
  const telnyxApiKey = await resolveTelnyxApiKey(
    orgId,
    data.telnyx_api_key_encrypted,
  );
  const telnyxSipPassword = await resolveTelnyxSipPassword(
    orgId,
    data.telnyx_sip_password_encrypted,
  );

  return {
    org_id: Number(data.org_id),
    messaging_provider: normalizeProvider(data.messaging_provider),
    twilio_account_sid: data.twilio_account_sid ?? null,
    twilio_auth_token: authToken,
    twilio_phone_number: data.twilio_phone_number ?? null,
    sms_enabled: data.sms_enabled === true,
    telnyx_api_key: telnyxApiKey,
    telnyx_phone_number: data.telnyx_phone_number ?? null,
    telnyx_messaging_profile_id: data.telnyx_messaging_profile_id ?? null,
    telnyx_sip_connection_id: data.telnyx_sip_connection_id ?? null,
    telnyx_telephony_credential_id: data.telnyx_telephony_credential_id ?? null,
    telnyx_sip_username: data.telnyx_sip_username ?? null,
    telnyx_sip_password: telnyxSipPassword,
    telnyx_caller_id: data.telnyx_caller_id ?? null,
  };
}

const matchPhoneRow = (
  rows: Array<Record<string, unknown>>,
  toPhone: string,
  column: string,
) => {
  const normalized = normalizeUsPhoneToE164(toPhone) ?? toPhone.trim();
  if (!normalized) return null;
  return (
    rows.find((row) => {
      const stored = row[column];
      if (typeof stored !== "string") return false;
      const storedNormalized = normalizeUsPhoneToE164(stored) ?? stored.trim();
      return storedNormalized === normalized;
    }) ?? null
  );
};

export async function findOrgByTwilioPhone(toPhone: string) {
  const { data, error } = await supabaseAdmin
    .from("organization_messaging_settings")
    .select("*")
    .eq("sms_enabled", true)
    .not("twilio_phone_number", "is", null);

  if (error || !data?.length) return null;
  return matchPhoneRow(data, toPhone, "twilio_phone_number");
}

export async function findOrgByTelnyxPhone(toPhone: string) {
  const { data, error } = await supabaseAdmin
    .from("organization_messaging_settings")
    .select("*")
    .eq("sms_enabled", true)
    .eq("messaging_provider", "telnyx")
    .not("telnyx_phone_number", "is", null);

  if (error || !data?.length) return null;
  return matchPhoneRow(data, toPhone, "telnyx_phone_number");
}

export async function upsertMessagingSettings(
  orgId: number,
  input: {
    messaging_provider?: MessagingProvider;
    twilio_account_sid?: string | null;
    twilio_auth_token?: string | null;
    twilio_phone_number?: string | null;
    sms_enabled?: boolean;
    keepExistingToken?: boolean;
    telnyx_api_key?: string | null;
    keepExistingTelnyxApiKey?: boolean;
    telnyx_phone_number?: string | null;
    telnyx_messaging_profile_id?: string | null;
    telnyx_sip_connection_id?: string | null;
    telnyx_telephony_credential_id?: string | null;
    telnyx_sip_username?: string | null;
    telnyx_sip_password?: string | null;
    keepExistingTelnyxSipPassword?: boolean;
    telnyx_caller_id?: string | null;
    business_hours?: MessagingSettingsPublic["business_hours"];
    out_of_hours_message?: string | null;
    auto_acknowledge_enabled?: boolean;
    auto_acknowledge_message?: string | null;
    voice_enabled?: boolean;
    voice_twiml_app_sid?: string | null;
    voice_api_key_sid?: string | null;
    voice_api_key_secret?: string | null;
    keepExistingVoiceApiKeySecret?: boolean;
    voice_caller_id?: string | null;
    voice_recording_default?: boolean;
    twilio_marketing_messaging_service_sid?: string | null;
    twilio_marketing_phone_number?: string | null;
    marketing_email_from?: string | null;
  },
) {
  const existing = await getMessagingSettingsSecrets(orgId);

  const accountSid =
    input.twilio_account_sid !== undefined
      ? input.twilio_account_sid?.trim() || null
      : existing?.twilio_account_sid ?? null;
  const phoneRaw =
    input.twilio_phone_number !== undefined
      ? input.twilio_phone_number?.trim() || null
      : existing?.twilio_phone_number ?? null;
  const phoneNumber = phoneRaw ? normalizeUsPhoneToE164(phoneRaw) : null;
  if (phoneRaw && !phoneNumber) {
    throw new Error("Invalid Twilio phone number. Use 10 digits.");
  }

  const telnyxPhoneRaw =
    input.telnyx_phone_number !== undefined
      ? input.telnyx_phone_number?.trim() || null
      : undefined;
  const telnyxPhoneNumber =
    telnyxPhoneRaw === undefined
      ? undefined
      : telnyxPhoneRaw
        ? normalizeUsPhoneToE164(telnyxPhoneRaw)
        : null;
  if (telnyxPhoneRaw && !telnyxPhoneNumber) {
    throw new Error("Invalid Telnyx phone number. Use 10 digits.");
  }

  const telnyxCallerRaw =
    input.telnyx_caller_id !== undefined
      ? input.telnyx_caller_id?.trim() || null
      : undefined;
  const telnyxCallerId =
    telnyxCallerRaw === undefined
      ? undefined
      : telnyxCallerRaw
        ? normalizeUsPhoneToE164(telnyxCallerRaw)
        : null;
  if (telnyxCallerRaw && !telnyxCallerId) {
    throw new Error("Invalid Telnyx caller ID. Use 10 digits.");
  }

  let authToken = input.twilio_auth_token?.trim() || null;
  if (input.keepExistingToken && !authToken) {
    authToken = existing?.twilio_auth_token ?? null;
  }

  let telnyxApiKey = input.telnyx_api_key?.trim() || null;
  if (input.keepExistingTelnyxApiKey && !telnyxApiKey) {
    telnyxApiKey = existing?.telnyx_api_key ?? null;
  }

  let telnyxSipPassword = input.telnyx_sip_password?.trim() || null;
  if (input.keepExistingTelnyxSipPassword && !telnyxSipPassword) {
    telnyxSipPassword = existing?.telnyx_sip_password ?? null;
  }

  const callerRaw =
    input.voice_caller_id !== undefined
      ? input.voice_caller_id?.trim() || null
      : undefined;
  const voiceCallerId =
    callerRaw === undefined
      ? undefined
      : callerRaw
        ? normalizeUsPhoneToE164(callerRaw)
        : null;
  if (callerRaw && !voiceCallerId) {
    throw new Error("Invalid outbound caller ID. Use 10 digits.");
  }

  const payload: Record<string, unknown> = {
    org_id: orgId,
    updated_at: new Date().toISOString(),
  };

  if (input.messaging_provider !== undefined) {
    payload.messaging_provider = normalizeProvider(input.messaging_provider);
  }

  const nextProvider =
    input.messaging_provider !== undefined
      ? normalizeProvider(input.messaging_provider)
      : normalizeProvider(existing?.messaging_provider);
  if (nextProvider === "telnyx") {
    const nextPhone =
      input.telnyx_phone_number !== undefined
        ? telnyxPhone
        : existing?.telnyx_phone_number?.trim() || null;
    const nextKey =
      telnyxApiKey ||
      (input.keepExistingTelnyxApiKey ? existing?.telnyx_api_key : null) ||
      existing?.telnyx_api_key ||
      null;
    if (!nextPhone || !nextKey?.trim()) {
      throw new Error(
        "Cannot use Telnyx without an API key and phone number. Save Telnyx credentials first.",
      );
    }
  }

  if (
    input.twilio_account_sid !== undefined ||
    input.twilio_phone_number !== undefined ||
    input.sms_enabled !== undefined ||
    input.business_hours !== undefined ||
    input.out_of_hours_message !== undefined ||
    input.auto_acknowledge_enabled !== undefined ||
    input.auto_acknowledge_message !== undefined
  ) {
    payload.twilio_account_sid = accountSid;
    payload.twilio_auth_token = null;
    payload.twilio_phone_number = phoneNumber;
    payload.sms_enabled =
      input.sms_enabled !== undefined
        ? input.sms_enabled === true
        : existing?.sms_enabled === true;
    payload.business_hours = input.business_hours ?? undefined;
    payload.out_of_hours_message = input.out_of_hours_message ?? undefined;
    payload.auto_acknowledge_enabled =
      input.auto_acknowledge_enabled ?? undefined;
    payload.auto_acknowledge_message =
      input.auto_acknowledge_message ?? undefined;
  }

  if (input.sms_enabled !== undefined && payload.sms_enabled === undefined) {
    payload.sms_enabled = input.sms_enabled === true;
  }

  if (input.telnyx_phone_number !== undefined) {
    payload.telnyx_phone_number = telnyxPhoneNumber ?? null;
  }
  if (input.telnyx_messaging_profile_id !== undefined) {
    payload.telnyx_messaging_profile_id =
      input.telnyx_messaging_profile_id?.trim() || null;
  }
  if (input.telnyx_sip_connection_id !== undefined) {
    payload.telnyx_sip_connection_id =
      input.telnyx_sip_connection_id?.trim() || null;
  }
  if (input.telnyx_telephony_credential_id !== undefined) {
    payload.telnyx_telephony_credential_id =
      input.telnyx_telephony_credential_id?.trim() || null;
  }
  if (input.telnyx_sip_username !== undefined) {
    payload.telnyx_sip_username = input.telnyx_sip_username?.trim() || null;
  }
  if (input.telnyx_caller_id !== undefined) {
    payload.telnyx_caller_id = telnyxCallerId ?? null;
  }

  if (input.voice_enabled !== undefined) {
    payload.voice_enabled = input.voice_enabled === true;
  }
  if (input.voice_twiml_app_sid !== undefined) {
    payload.voice_twiml_app_sid = input.voice_twiml_app_sid?.trim() || null;
  }
  if (input.voice_api_key_sid !== undefined) {
    payload.voice_api_key_sid = input.voice_api_key_sid?.trim() || null;
  }
  if (input.voice_caller_id !== undefined) {
    payload.voice_caller_id = voiceCallerId ?? null;
  }
  if (input.voice_recording_default !== undefined) {
    payload.voice_recording_default = input.voice_recording_default === true;
  }
  if (input.twilio_marketing_messaging_service_sid !== undefined) {
    payload.twilio_marketing_messaging_service_sid =
      input.twilio_marketing_messaging_service_sid?.trim() || null;
  }
  if (input.twilio_marketing_phone_number !== undefined) {
    const marketingPhoneRaw =
      input.twilio_marketing_phone_number?.trim() || null;
    const marketingPhone = marketingPhoneRaw
      ? normalizeUsPhoneToE164(marketingPhoneRaw)
      : null;
    if (marketingPhoneRaw && !marketingPhone) {
      throw new Error("Invalid marketing phone number. Use 10 digits.");
    }
    payload.twilio_marketing_phone_number = marketingPhone;
  }
  if (input.marketing_email_from !== undefined) {
    payload.marketing_email_from = input.marketing_email_from?.trim() || null;
  }

  const { error } = await supabaseAdmin
    .from("organization_messaging_settings")
    .upsert(payload, { onConflict: "org_id" });

  if (error) {
    throw new Error(error.message ?? "Failed to save messaging settings");
  }

  const key = getPgcryptoKey();

  if (authToken) {
    if (!key) throw new Error("PGCRYPTO_KEY is not configured");
    const { error: encryptError } = await supabaseAdmin.rpc(
      "set_twilio_auth_token",
      { p_org_id: orgId, p_token: authToken, p_key: key },
    );
    if (encryptError) {
      throw new Error(
        encryptError.message ?? "Failed to encrypt Twilio auth token",
      );
    }
  }

  // Only write the secret when a new value is provided. Empty + keepExisting
  // must skip — calling set_* with "" clears the encrypted column.
  if (input.telnyx_api_key !== undefined && telnyxApiKey) {
    if (!key) throw new Error("PGCRYPTO_KEY is not configured");
    const { error: telnyxKeyError } = await supabaseAdmin.rpc(
      "set_telnyx_api_key",
      {
        p_org_id: orgId,
        p_token: telnyxApiKey,
        p_key: key,
      },
    );
    if (telnyxKeyError) {
      throw new Error(
        telnyxKeyError.message ?? "Failed to encrypt Telnyx API key",
      );
    }
  }

  if (input.telnyx_sip_password !== undefined && telnyxSipPassword) {
    if (!key) throw new Error("PGCRYPTO_KEY is not configured");
    const { error: sipError } = await supabaseAdmin.rpc(
      "set_telnyx_sip_password",
      {
        p_org_id: orgId,
        p_token: telnyxSipPassword,
        p_key: key,
      },
    );
    if (sipError) {
      throw new Error(
        sipError.message ?? "Failed to encrypt Telnyx SIP password",
      );
    }
  }

  if (input.voice_api_key_secret?.trim()) {
    if (!key) throw new Error("PGCRYPTO_KEY is not configured");
    const { error: voiceKeyError } = await supabaseAdmin.rpc(
      "set_voice_api_key_secret",
      {
        p_org_id: orgId,
        p_secret: input.voice_api_key_secret.trim(),
        p_key: key,
      },
    );
    if (voiceKeyError) {
      throw new Error(
        voiceKeyError.message ?? "Failed to encrypt Voice API key secret",
      );
    }
  } else if (input.keepExistingVoiceApiKeySecret === false) {
    await supabaseAdmin
      .from("organization_messaging_settings")
      .update({
        voice_api_key_secret_encrypted: null,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId);
  }

  return getMessagingSettingsPublic(orgId);
}

// Re-export for callers that imported webhook helpers from voiceSettings via messaging
export { getVoiceWebhookUrls };
