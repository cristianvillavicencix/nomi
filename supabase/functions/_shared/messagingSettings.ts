import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "./supabaseAdmin.ts";
import { getUserOrganizationMember } from "./getUserOrganizationMember.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";

export type MessagingSettingsPublic = {
  org_id: number;
  twilio_account_sid: string | null;
  twilio_phone_number: string | null;
  sms_enabled: boolean;
  has_auth_token: boolean;
  webhook_url: string | null;
  business_hours?: Record<string, { open?: string | null; close?: string | null; closed?: boolean }> | null;
  out_of_hours_message?: string | null;
  auto_acknowledge_enabled?: boolean;
  auto_acknowledge_message?: string | null;
};

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
      throw new Error("PGCRYPTO_KEY is not configured for Twilio token decryption");
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
      "org_id, twilio_account_sid, twilio_phone_number, sms_enabled, twilio_auth_token, twilio_auth_token_encrypted, business_hours, out_of_hours_message, auto_acknowledge_enabled, auto_acknowledge_message",
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
      data?.twilio_auth_token_encrypted?.trim() || data?.twilio_auth_token?.trim(),
    ),
    webhook_url: getWebhookUrl(),
    business_hours: (data?.business_hours as MessagingSettingsPublic["business_hours"]) ?? null,
    out_of_hours_message: data?.out_of_hours_message ?? null,
    auto_acknowledge_enabled: data?.auto_acknowledge_enabled === true,
    auto_acknowledge_message: data?.auto_acknowledge_message ?? null,
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
  },
) {
  const existing = await getMessagingSettingsSecrets(orgId);

  const accountSid = input.twilio_account_sid?.trim() || null;
  const phoneRaw = input.twilio_phone_number?.trim() || null;
  const phoneNumber = phoneRaw ? normalizeUsPhoneToE164(phoneRaw) : null;
  if (phoneRaw && !phoneNumber) {
    throw new Error("Invalid Twilio phone number. Use 10 digits.");
  }

  let authToken = input.twilio_auth_token?.trim() || null;
  if (input.keepExistingToken && !authToken) {
    authToken = existing?.twilio_auth_token ?? null;
  }

  const payload = {
    org_id: orgId,
    twilio_account_sid: accountSid,
    twilio_auth_token: null,
    twilio_phone_number: phoneNumber,
    sms_enabled: input.sms_enabled === true,
    business_hours: input.business_hours ?? undefined,
    out_of_hours_message: input.out_of_hours_message ?? undefined,
    auto_acknowledge_enabled: input.auto_acknowledge_enabled ?? undefined,
    auto_acknowledge_message: input.auto_acknowledge_message ?? undefined,
    updated_at: new Date().toISOString(),
  };

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
    const { error: encryptError } = await supabaseAdmin.rpc("set_twilio_auth_token", {
      p_org_id: orgId,
      p_token: authToken,
      p_key: key,
    });
    if (encryptError) {
      throw new Error(encryptError.message ?? "Failed to encrypt Twilio auth token");
    }
  }

  return getMessagingSettingsPublic(orgId);
}
