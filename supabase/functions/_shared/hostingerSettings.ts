import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "./supabaseAdmin.ts";
import { getUserOrganizationMember } from "./getUserOrganizationMember.ts";

export type HostingerSettingsPublic = {
  org_id: number;
  has_api_token: boolean;
  has_mail_api_token: boolean;
  weekly_sync_enabled: boolean;
  referral_code: string | null;
  referral_link_template: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
};

const getPgcryptoKey = () => Deno.env.get("PGCRYPTO_KEY")?.trim() ?? "";

export async function assertOrgAdministrator(user: User, orgId: number) {
  const member = await getUserOrganizationMember(user);
  if (!member?.administrator) {
    throw new Error("Only administrators can manage Hostinger settings");
  }
  if (Number(member.org_id) !== orgId) {
    throw new Error("Organization mismatch");
  }
}

export async function getHostingerMailApiToken(orgId: number): Promise<string | null> {
  const key = getPgcryptoKey();
  if (!key) {
    throw new Error("PGCRYPTO_KEY is not configured for Hostinger token decryption");
  }

  const { data, error } = await supabaseAdmin.rpc("get_hostinger_mail_api_token", {
    p_org_id: orgId,
    p_key: key,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to decrypt Hostinger Mail API token");
  }

  return typeof data === "string" && data.trim() ? data.trim() : null;
}

export async function getHostingerApiToken(orgId: number): Promise<string | null> {
  const key = getPgcryptoKey();
  if (!key) {
    throw new Error("PGCRYPTO_KEY is not configured for Hostinger token decryption");
  }

  const { data, error } = await supabaseAdmin.rpc("get_hostinger_api_token", {
    p_org_id: orgId,
    p_key: key,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to decrypt Hostinger API token");
  }

  return typeof data === "string" && data.trim() ? data.trim() : null;
}

export async function getHostingerSettingsPublic(
  orgId: number,
): Promise<HostingerSettingsPublic> {
  const { data, error } = await supabaseAdmin
    .from("organization_hostinger_settings")
    .select(
      "org_id, api_token_encrypted, mail_api_token_encrypted, weekly_sync_enabled, referral_code, referral_link_template, last_synced_at, last_sync_error",
    )
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load Hostinger settings");
  }

  return {
    org_id: orgId,
    has_api_token: Boolean(data?.api_token_encrypted?.trim()),
    has_mail_api_token: Boolean(data?.mail_api_token_encrypted?.trim()),
    weekly_sync_enabled: data?.weekly_sync_enabled !== false,
    referral_code: data?.referral_code?.trim() || null,
    referral_link_template: data?.referral_link_template?.trim() || null,
    last_synced_at: data?.last_synced_at ?? null,
    last_sync_error: data?.last_sync_error ?? null,
  };
}

export async function updateHostingerSettings(
  orgId: number,
  params: {
    weekly_sync_enabled?: boolean;
    referral_code?: string | null;
    referral_link_template?: string | null;
  },
) {
  const { error } = await supabaseAdmin
    .from("organization_hostinger_settings")
    .upsert(
      {
        org_id: orgId,
        ...(params.weekly_sync_enabled !== undefined
          ? { weekly_sync_enabled: params.weekly_sync_enabled }
          : {}),
        ...(params.referral_code !== undefined
          ? { referral_code: params.referral_code?.trim() || null }
          : {}),
        ...(params.referral_link_template !== undefined
          ? {
            referral_link_template: params.referral_link_template?.trim() || null,
          }
          : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    );

  if (error) {
    throw new Error(error.message ?? "Failed to update Hostinger settings");
  }
}

export async function upsertHostingerMailApiToken(orgId: number, mailApiToken: string) {
  const trimmed = mailApiToken.trim();
  if (!trimmed) {
    throw new Error("Mail API token is required");
  }

  const key = getPgcryptoKey();
  if (!key) {
    throw new Error("PGCRYPTO_KEY is not configured for Hostinger token encryption");
  }

  const { error } = await supabaseAdmin.rpc("set_hostinger_mail_api_token", {
    p_org_id: orgId,
    p_token: trimmed,
    p_key: key,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to save Hostinger Mail API token");
  }
}

export async function upsertHostingerApiToken(orgId: number, apiToken: string) {
  const trimmed = apiToken.trim();
  if (!trimmed) {
    throw new Error("API token is required");
  }

  const key = getPgcryptoKey();
  if (!key) {
    throw new Error("PGCRYPTO_KEY is not configured for Hostinger token encryption");
  }

  const { error } = await supabaseAdmin.rpc("set_hostinger_api_token", {
    p_org_id: orgId,
    p_token: trimmed,
    p_key: key,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to save Hostinger API token");
  }
}

export async function updateHostingerSyncMetadata(
  orgId: number,
  params: { last_synced_at?: string | null; last_sync_error?: string | null },
) {
  const { error } = await supabaseAdmin
    .from("organization_hostinger_settings")
    .upsert(
      {
        org_id: orgId,
        ...(params.last_synced_at !== undefined
          ? { last_synced_at: params.last_synced_at }
          : {}),
        ...(params.last_sync_error !== undefined
          ? { last_sync_error: params.last_sync_error }
          : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    );

  if (error) {
    throw new Error(error.message ?? "Failed to update Hostinger sync metadata");
  }
}
