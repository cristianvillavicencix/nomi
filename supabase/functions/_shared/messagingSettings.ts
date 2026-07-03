import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "./supabaseAdmin.ts";
import { getUserOrganizationMember } from "./getUserOrganizationMember.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";
import {
  getVoiceSettingsPublicFromRow,
  getVoiceWebhookUrls,
  type VoiceSettingsPublic,
} from "./voiceSettings.ts";

export type MessagingSettingsPublic = {
  org_id: number;
  twilio_account_sid: string | null;
  twilio_phone_number: string | null;
  sms_enabled: boolean;
  has_auth_token: boolean;
  webhook_url: string | null;
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
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_phone_number: string | null;
  sms_enabled: boolean;
};

const getWebhookUrl = () => {
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) return null;
  return `${base}/functions/v1/twilio_inbound_sms`;
};

const getPgcryptoKey = () => Deno.env.get("PGCRYPTO_KEY")?.trim() ?? "";

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

export async function getMessagingSettingsPublic(
  orgId: number,
): Promise<MessagingSettingsPublic> {
  const { data, error } = await supabaseAdmin
    .from("organization_messaging_settings")
    .select(
      "org_id, twilio_account_sid, twilio_phone_number, sms_enabled, twilio_auth_token, twilio_auth_token_encrypted, business_hours, out_of_hours_message, auto_acknowledge_enabled, auto_acknowledge_message, twilio_marketing_messaging_service_sid, twilio_marketing_phone_number, marketing_email_from, voice_enabled, voice_twiml_app_sid, voice_api_key_sid, voice_api_key_secret_encrypted, voice_caller_id, voice_recording_default",
    )
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load messaging settings");
  }

  return {
    org_id: orgId,
    twilio_account_sid: data?.twilio_account_sid ?? null,
    twilio_phone_number: data?.twilio_phone_number ?? null,
    sms_enabled: data?.sms_enabled === true,
    has_auth_token: Boolean(
      data?.twilio_auth_token_encrypted?.trim() ||
        data?.twilio_auth_token?.trim(),
    ),
    webhook_url: getWebhookUrl(),
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

  return {
    org_id: Number(data.org_id),
    twilio_account_sid: data.twilio_account_sid ?? null,
    twilio_auth_token: authToken,
    twilio_phone_number: data.twilio_phone_number ?? null,
    sms_enabled: data.sms_enabled === true,
  };
}

export async function findOrgByTwilioPhone(toPhone: string) {
  const normalized = normalizeUsPhoneToE164(toPhone) ?? toPhone.trim();
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin
    .from("organization_messaging_settings")
    .select("*")
    .eq("sms_enabled", true)
    .not("twilio_phone_number", "is", null);

  if (error || !data?.length) return null;

  return (
    data.find((row) => {
      const stored = row.twilio_phone_number;
      if (typeof stored !== "string") return false;
      const storedNormalized = normalizeUsPhoneToE164(stored) ?? stored.trim();
      return storedNormalized === normalized;
    }) ?? null
  );
}

export async function upsertMessagingSettings(
  orgId: number,
  input: {
    twilio_account_sid?: string | null;
    twilio_auth_token?: string | null;
    twilio_phone_number?: string | null;
    sms_enabled?: boolean;
    keepExistingToken?: boolean;
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

  let authToken = input.twilio_auth_token?.trim() || null;
  if (input.keepExistingToken && !authToken) {
    authToken = existing?.twilio_auth_token ?? null;
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

  if (authToken) {
    const key = getPgcryptoKey();
    if (!key) {
      throw new Error("PGCRYPTO_KEY is not configured");
    }
    const { error: encryptError } = await supabaseAdmin.rpc(
      "set_twilio_auth_token",
      {
        p_org_id: orgId,
        p_token: authToken,
        p_key: key,
      },
    );
    if (encryptError) {
      throw new Error(
        encryptError.message ?? "Failed to encrypt Twilio auth token",
      );
    }
  }

  if (input.voice_api_key_secret?.trim()) {
    const key = getPgcryptoKey();
    if (!key) {
      throw new Error("PGCRYPTO_KEY is not configured");
    }
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
      .update({ voice_api_key_secret_encrypted: null, updated_at: new Date().toISOString() })
      .eq("org_id", orgId);
  }

  return getMessagingSettingsPublic(orgId);
}
