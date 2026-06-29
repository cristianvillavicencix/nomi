import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import {
  assertMemberCanAccessConversation,
} from "./messagingConversations.ts";
import { sendTwilioSms } from "./twilio.ts";
import { resolveTwilioMediaUrls } from "./twilioMedia.ts";
import { supabaseAdmin } from "./supabaseAdmin.ts";

const normalizeTwilioDeliveryStatus = (raw: string | undefined | null) => {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  switch (value) {
    case "queued":
    case "sending":
    case "sent":
    case "delivered":
    case "undelivered":
    case "failed":
    case "canceled":
      return value;
    case "accepted":
      return "queued";
    default:
      return null;
  }
};

const getStoredMediaUrls = (message: {
  media_url?: string | null;
  media_urls?: string[] | null;
}) => {
  const urls = (message.media_urls ?? [])
    .map((entry) => entry?.trim())
    .filter(Boolean) as string[];
  if (urls.length > 0) return urls;
  const legacy = message.media_url?.trim();
  return legacy ? [legacy] : [];
};

export async function resendFailedClientSms(params: {
  orgId: number;
  memberId: number;
  messageId: number;
}) {
  const { data: existing, error: loadError } = await supabaseAdmin
    .from("conversation_messages")
    .select("*")
    .eq("id", params.messageId)
    .maybeSingle();

  if (loadError || !existing) {
    throw new Error("Message not found");
  }

  if (existing.is_internal_note) {
    throw new Error("Internal notes cannot be resent");
  }

  if (existing.direction !== "outbound") {
    throw new Error("Only outbound messages can be resent");
  }

  const deliveryStatus = normalizeTwilioDeliveryStatus(
    existing.sms_delivery_status,
  );
  if (deliveryStatus !== "undelivered" && deliveryStatus !== "failed") {
    throw new Error("Only failed messages can be resent");
  }

  const conversationId = Number(existing.conversation_id);
  await assertMemberCanAccessConversation(
    params.memberId,
    params.orgId,
    conversationId,
  );

  const { data: phoneRow, error: phoneError } = await supabaseAdmin
    .from("conversations")
    .select("external_phone")
    .eq("id", conversationId)
    .eq("org_id", params.orgId)
    .single();

  if (phoneError || !phoneRow?.external_phone) {
    throw new Error("Client phone number is missing on this conversation");
  }

  const body = String(existing.body ?? "").trim();
  const mediaUrls = getStoredMediaUrls(existing);
  if (!body && mediaUrls.length === 0) {
    throw new Error("Message has no content to resend");
  }

  const settings = await getMessagingSettingsSecrets(params.orgId);
  if (!settings?.sms_enabled) {
    throw new Error("SMS is disabled in Settings → Communications");
  }

  const accountSid = settings.twilio_account_sid?.trim();
  const authToken = settings.twilio_auth_token?.trim();
  const fromNumber = settings.twilio_phone_number?.trim();

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      "Twilio is not fully configured in Settings → Communications",
    );
  }

  const twilioMediaUrls = await resolveTwilioMediaUrls(mediaUrls);
  const twilioResponse = await sendTwilioSms({
    accountSid,
    authToken,
    from: fromNumber,
    to: phoneRow.external_phone,
    body,
    mediaUrls: twilioMediaUrls,
  });

  const externalId = twilioResponse.sid ?? null;
  const initialDeliveryStatus = externalId
    ? (normalizeTwilioDeliveryStatus(twilioResponse.status) ?? "queued")
    : null;

  const { data: message, error: updateError } = await supabaseAdmin
    .from("conversation_messages")
    .update({
      external_id: externalId,
      sms_delivery_status: initialDeliveryStatus,
      sms_error_code: null,
    })
    .eq("id", params.messageId)
    .select("*")
    .single();

  if (updateError || !message) {
    throw new Error(updateError?.message ?? "Failed to update message");
  }

  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  return { message, conversation: conversation ?? null };
}
