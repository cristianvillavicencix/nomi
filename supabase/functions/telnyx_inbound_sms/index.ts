import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  findOrgByTelnyxPhone,
} from "../_shared/messagingSettings.ts";
import {
  ensureClientConversation,
  findContactByPhone,
  insertSmsMessage,
} from "../_shared/messagingConversations.ts";
import { normalizeUsPhoneToE164 } from "../_shared/phone.ts";
import {
  normalizeTelnyxDeliveryStatus,
  validateTelnyxWebhookSignature,
} from "../_shared/telnyx.ts";
import { sendOrgSms } from "../_shared/sendOrgSms.ts";
import {
  expandAutoAckMessage,
  isWithinBusinessHours,
} from "../_shared/businessHours.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  isSmsOptOutMessage,
  SMS_OPT_OUT_CONFIRMATION,
} from "../_shared/marketingOptOut.ts";
import { recordSmsMarketingOptOut } from "../_shared/marketingAudience.ts";
import { mirrorTelnyxMediaToStorage } from "../_shared/telnyxMedia.ts";

const okResponse = () =>
  new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type TelnyxInboundPayload = {
  data?: {
    event_type?: string;
    payload?: {
      id?: string;
      from?: { phone_number?: string } | string;
      to?: Array<{ phone_number?: string }> | { phone_number?: string } | string;
      text?: string;
      media?: Array<{ url?: string }>;
    };
  };
};

const phoneFromField = (
  value:
    | { phone_number?: string }
    | string
    | Array<{ phone_number?: string }>
    | undefined,
): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    return value[0]?.phone_number?.trim() || null;
  }
  return value.phone_number?.trim() || null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method not allowed");
  }

  try {
    const rawBody = await req.text();
    const valid = await validateTelnyxWebhookSignature(req, rawBody);
    if (!valid) {
      return createErrorResponse(403, "Invalid Telnyx signature");
    }

    const body = JSON.parse(rawBody) as TelnyxInboundPayload;
    const eventType = body.data?.event_type?.trim() ?? "";
    const payload = body.data?.payload;
    if (!payload) {
      return createErrorResponse(400, "Missing Telnyx payload");
    }

    // Ignore status events on the inbound URL
    if (eventType && !eventType.includes("received") && !eventType.includes("message.received")) {
      if (eventType.includes("finalized") || eventType.includes("sent")) {
        return okResponse();
      }
    }

    const fromPhone = phoneFromField(payload.from);
    const toPhone = phoneFromField(payload.to);
    const text = payload.text?.trim() ?? "";
    const messageId = payload.id?.trim();
    const mediaUrls = (payload.media ?? [])
      .map((m) => m.url?.trim())
      .filter(Boolean) as string[];

    if (!fromPhone || !toPhone || (!text && mediaUrls.length === 0)) {
      return createErrorResponse(400, "Missing Telnyx message fields");
    }

    const orgSettings = await findOrgByTelnyxPhone(toPhone);
    if (!orgSettings?.org_id) {
      return createErrorResponse(404, "Unknown Telnyx number");
    }

    const orgId = Number(orgSettings.org_id);
    const conversation = await ensureClientConversation({
      orgId,
      externalPhone: fromPhone,
    });

    if (messageId) {
      const { data: existing } = await supabaseAdmin
        .from("conversation_messages")
        .select("id")
        .eq("external_id", messageId)
        .maybeSingle();
      if (existing?.id) {
        return okResponse();
      }
    }

    const messageBody =
      text ||
      (mediaUrls.length > 1
        ? `${mediaUrls.length} attachments`
        : mediaUrls.length === 1
          ? "Attachment"
          : "");

    let storedMediaUrls: string[] = [];
    if (mediaUrls.length > 0) {
      const mirrored = await Promise.all(
        mediaUrls.map((mediaUrl) =>
          mirrorTelnyxMediaToStorage({
            mediaUrl,
            orgId,
            conversationId: Number(conversation.id),
          }).catch((mirrorError) => {
            console.error("Failed to mirror inbound Telnyx MMS", mirrorError);
            return null;
          }),
        ),
      );
      storedMediaUrls = mirrored.filter(
        (url): url is string => typeof url === "string" && url.length > 0,
      );
    }

    await insertSmsMessage({
      conversationId: Number(conversation.id),
      body: messageBody || "Message",
      direction: "inbound",
      externalId: messageId ?? null,
      mediaUrls: storedMediaUrls.length > 0 ? storedMediaUrls : mediaUrls,
      smsDeliveryStatus: normalizeTelnyxDeliveryStatus("delivered"),
    });

    const contact = await findContactByPhone(orgId, fromPhone);

    if (isSmsOptOutMessage(text)) {
      const normalizedFrom =
        normalizeUsPhoneToE164(fromPhone) ?? fromPhone.trim();
      await recordSmsMarketingOptOut({
        orgId,
        phoneE164: normalizedFrom,
        contactId: contact?.id != null ? Number(contact.id) : null,
        reason: "stop_reply",
      });
      try {
        await sendOrgSms({
          orgId,
          to: fromPhone,
          body: SMS_OPT_OUT_CONFIRMATION,
          from: toPhone,
        });
        await insertSmsMessage({
          conversationId: Number(conversation.id),
          body: SMS_OPT_OUT_CONFIRMATION,
          direction: "outbound",
        });
      } catch (err) {
        console.error("telnyx_inbound_sms opt-out reply failed", err);
      }
      return okResponse();
    }

    const fullSettings = await supabaseAdmin
      .from("organization_messaging_settings")
      .select(
        "auto_acknowledge_enabled, auto_acknowledge_message, out_of_hours_message, business_hours",
      )
      .eq("org_id", orgId)
      .maybeSingle();

    const withinHours = isWithinBusinessHours(
      fullSettings.data?.business_hours as Record<
        string,
        { open?: string; close?: string; closed?: boolean }
      > | null,
    );

    let autoReply: string | null = null;
    if (!withinHours && fullSettings.data?.out_of_hours_message?.trim()) {
      autoReply = fullSettings.data.out_of_hours_message.trim();
    } else if (
      fullSettings.data?.auto_acknowledge_enabled &&
      fullSettings.data.auto_acknowledge_message?.trim()
    ) {
      autoReply = fullSettings.data.auto_acknowledge_message.trim();
    }

    if (autoReply) {
      const clientName = contact
        ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
        : "";
      const replyBody = expandAutoAckMessage(autoReply, {
        client_name: clientName,
        contact_name: clientName,
      });
      if (replyBody.trim()) {
        try {
          await sendOrgSms({
            orgId,
            to: fromPhone,
            body: replyBody,
            from: toPhone,
          });
          await insertSmsMessage({
            conversationId: Number(conversation.id),
            body: replyBody,
            direction: "outbound",
          });
        } catch (err) {
          console.error("telnyx_inbound_sms auto-reply failed", err);
        }
      }
    }

    return okResponse();
  } catch (error) {
    console.error("telnyx_inbound_sms", error);
    const message = error instanceof Error ? error.message : "Webhook failed";
    return createErrorResponse(500, message);
  }
});
