import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { generateUniqueShortCode } from "./formTokenUtils.ts";

export type SubscriptionSharePurpose = "setup" | "agreement";

export const buildSubscriptionSetupSharePath = (shortCode: string) =>
  `/sub/${shortCode.trim()}`;

export const buildSubscriptionAgreementSharePath = (shortCode: string) =>
  `/sub-agree/${shortCode.trim()}`;

export const buildSubscriptionSetupShareUrl = (
  baseUrl: string,
  shortCode: string,
) => `${baseUrl.replace(/\/$/, "")}${buildSubscriptionSetupSharePath(shortCode)}`;

export const buildSubscriptionAgreementShareUrl = (
  baseUrl: string,
  shortCode: string,
) =>
  `${baseUrl.replace(/\/$/, "")}${buildSubscriptionAgreementSharePath(shortCode)}`;

async function ensureSubscriptionShareLink(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    subscriptionId: number;
    baseUrl: string;
    purpose: SubscriptionSharePurpose;
    checkoutUrl?: string | null;
  },
) {
  const purpose = params.purpose;
  const checkoutUrl = params.checkoutUrl?.trim() || null;

  const { data: existing } = await supabase
    .from("public_client_subscription_setup_tokens")
    .select("id, short_code, purpose")
    .eq("subscription_id", params.subscriptionId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  const now = new Date().toISOString();
  let shortCode = existing?.short_code?.trim() ?? "";

  if (existing?.id && shortCode) {
    const update: Record<string, unknown> = {
      purpose,
      updated_at: now,
    };
    if (checkoutUrl) {
      update.checkout_url = checkoutUrl;
    }
    await supabase
      .from("public_client_subscription_setup_tokens")
      .update(update)
      .eq("id", existing.id);
  } else {
    shortCode = await generateUniqueShortCode(async (code) => {
      const { data: hit } = await supabase
        .from("public_client_subscription_setup_tokens")
        .select("id")
        .eq("short_code", code)
        .maybeSingle();
      return Boolean(hit?.id);
    });

    const { error } = await supabase
      .from("public_client_subscription_setup_tokens")
      .insert({
        org_id: params.orgId,
        subscription_id: params.subscriptionId,
        short_code: shortCode,
        checkout_url: checkoutUrl,
        purpose,
        updated_at: now,
      });

    if (error) {
      throw new Error(error.message);
    }
  }

  const shareUrl =
    purpose === "agreement"
      ? buildSubscriptionAgreementShareUrl(params.baseUrl, shortCode)
      : buildSubscriptionSetupShareUrl(params.baseUrl, shortCode);

  const subUpdate: Record<string, unknown> = {
    setup_short_code: shortCode,
    setup_share_url: shareUrl,
    updated_at: now,
  };
  if (checkoutUrl) {
    subUpdate.setup_checkout_url = checkoutUrl;
  }

  await supabase
    .from("client_subscriptions")
    .update(subUpdate)
    .eq("id", params.subscriptionId);

  return { shortCode, shareUrl };
}

export async function ensureSubscriptionSetupShareLink(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    subscriptionId: number;
    checkoutUrl: string;
    baseUrl: string;
  },
) {
  const checkoutUrl = params.checkoutUrl.trim();
  if (!checkoutUrl) {
    throw new Error("Missing checkout URL for subscription setup link");
  }
  return ensureSubscriptionShareLink(supabase, {
    orgId: params.orgId,
    subscriptionId: params.subscriptionId,
    baseUrl: params.baseUrl,
    purpose: "setup",
    checkoutUrl,
  });
}

export async function ensureSubscriptionAgreementShareLink(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    subscriptionId: number;
    baseUrl: string;
    checkoutUrl?: string | null;
  },
) {
  return ensureSubscriptionShareLink(supabase, {
    orgId: params.orgId,
    subscriptionId: params.subscriptionId,
    baseUrl: params.baseUrl,
    purpose: "agreement",
    checkoutUrl: params.checkoutUrl ?? null,
  });
}
