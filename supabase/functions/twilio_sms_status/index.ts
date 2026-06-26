import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getMessagingSettingsSecrets } from "../_shared/messagingSettings.ts";
import { validateTwilioSignatureForStatusCallback } from "../_shared/twilio.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const parseFormBody = async (req: Request) => {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const record: Record<string, string> = {};
  params.forEach((value, key) => {
    record[key] = value;
  });
  return record;
};

const normalizeDeliveryStatus = (raw: string | undefined) => {
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

const emptyResponse = () =>
  new Response(null, { status: 204, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return createErrorResponse(405, "Method not allowed");
  }

  try {
    const params = await parseFormBody(req);
    const messageSid = params.MessageSid?.trim();
    const messageStatus = normalizeDeliveryStatus(params.MessageStatus);
    const accountSid = params.AccountSid?.trim();
    const errorCode = params.ErrorCode?.trim() || null;

    if (!messageSid || !messageStatus) {
      return createErrorResponse(400, "Missing Twilio status fields");
    }

    const { data: messageRow, error: messageError } = await supabaseAdmin
      .from("conversation_messages")
      .select("id, conversation_id")
      .eq("external_id", messageSid)
      .maybeSingle();

    if (messageError) {
      throw new Error(messageError.message ?? "Failed to load message");
    }

    if (!messageRow?.id) {
      console.warn("twilio_sms_status: unknown MessageSid", messageSid);
      return emptyResponse();
    }

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .select("org_id")
      .eq("id", messageRow.conversation_id)
      .maybeSingle();

    if (conversationError || !conversation?.org_id) {
      return emptyResponse();
    }

    const orgId = Number(conversation.org_id);

    const settings = await getMessagingSettingsSecrets(orgId);
    const authToken = settings?.twilio_auth_token?.trim();
    const storedAccountSid = settings?.twilio_account_sid?.trim();

    if (!authToken) {
      return createErrorResponse(403, "Twilio auth token not configured");
    }

    if (accountSid && storedAccountSid && accountSid !== storedAccountSid) {
      console.error("twilio_sms_status account sid mismatch", {
        accountSid,
        storedAccountSid,
      });
      return createErrorResponse(403, "Account mismatch");
    }

    const signature = req.headers.get("X-Twilio-Signature");
    const validSignature = await validateTwilioSignatureForStatusCallback(
      authToken,
      signature,
      req,
      params,
    );

    if (!validSignature) {
      return createErrorResponse(403, "Invalid Twilio signature");
    }

    const { error: updateError } = await supabaseAdmin
      .from("conversation_messages")
      .update({
        sms_delivery_status: messageStatus,
        sms_error_code: errorCode,
      })
      .eq("id", messageRow.id);

    if (updateError) {
      throw new Error(
        updateError.message ?? "Failed to update delivery status",
      );
    }

    return emptyResponse();
  } catch (error) {
    console.error("twilio_sms_status", error);
    const message = error instanceof Error ? error.message : "Webhook failed";
    return createErrorResponse(500, message);
  }
});
