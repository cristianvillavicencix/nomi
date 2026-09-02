import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type SubscriptionDeliveryChannel = "email" | "sms";
export type SubscriptionDeliveryPurpose =
  | "agreement_invite"
  | "agreement_completion"
  | "setup_link";

export async function logSubscriptionDelivery(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    subscriptionId: number;
    channel: SubscriptionDeliveryChannel;
    purpose: SubscriptionDeliveryPurpose;
    toAddress: string;
    subject?: string | null;
    bodyPreview?: string | null;
    status: "sent" | "skipped" | "failed";
    providerId?: string | null;
    errorMessage?: string | null;
    createdBy?: number | null;
  },
) {
  const toAddress = params.toAddress.trim();
  if (!toAddress) return;

  const { error } = await supabase.from("client_subscription_delivery_logs").insert({
    org_id: params.orgId,
    subscription_id: params.subscriptionId,
    channel: params.channel,
    purpose: params.purpose,
    to_address: toAddress,
    subject: params.subject?.trim() || null,
    body_preview: params.bodyPreview?.trim()?.slice(0, 2000) || null,
    status: params.status,
    provider_id: params.providerId?.trim() || null,
    error_message: params.errorMessage?.trim()?.slice(0, 500) || null,
    created_by: params.createdBy ?? null,
  });

  if (error) {
    console.warn("logSubscriptionDelivery.failed", error.message);
  }
}
