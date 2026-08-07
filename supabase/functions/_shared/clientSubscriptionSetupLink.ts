import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { generateUniqueShortCode } from "./formTokenUtils.ts";

export const buildSubscriptionSetupSharePath = (shortCode: string) =>
  `/sub/${shortCode.trim()}`;

export const buildSubscriptionSetupShareUrl = (
  baseUrl: string,
  shortCode: string,
) => `${baseUrl.replace(/\/$/, "")}${buildSubscriptionSetupSharePath(shortCode)}`;

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

  const { data: existing } = await supabase
    .from("public_client_subscription_setup_tokens")
    .select("id, short_code")
    .eq("subscription_id", params.subscriptionId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  const now = new Date().toISOString();
  let shortCode = existing?.short_code?.trim() ?? "";

  if (existing?.id && shortCode) {
    await supabase
      .from("public_client_subscription_setup_tokens")
      .update({ checkout_url: checkoutUrl, updated_at: now })
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
        updated_at: now,
      });

    if (error) {
      throw new Error(error.message);
    }
  }

  const shareUrl = buildSubscriptionSetupShareUrl(params.baseUrl, shortCode);

  await supabase
    .from("client_subscriptions")
    .update({
      setup_short_code: shortCode,
      setup_share_url: shareUrl,
      setup_checkout_url: checkoutUrl,
      updated_at: now,
    })
    .eq("id", params.subscriptionId);

  return { shortCode, shareUrl };
}
