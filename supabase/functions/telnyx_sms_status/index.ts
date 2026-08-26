import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  normalizeTelnyxDeliveryStatus,
  validateTelnyxWebhookSignature,
} from "../_shared/telnyx.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const emptyResponse = () =>
  new Response(null, { status: 204, headers: corsHeaders });

type TelnyxStatusPayload = {
  data?: {
    event_type?: string;
    payload?: {
      id?: string;
      to?: Array<{ status?: string; phone_number?: string }>;
      errors?: Array<{ code?: string | number }>;
    };
  };
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

    const body = JSON.parse(rawBody) as TelnyxStatusPayload;
    const payload = body.data?.payload;
    const messageId = payload?.id?.trim();
    const rawStatus = payload?.to?.[0]?.status;
    const messageStatus = normalizeTelnyxDeliveryStatus(rawStatus);
    const errorCode =
      payload?.errors?.[0]?.code != null
        ? String(payload.errors[0].code)
        : null;

    if (!messageId || !messageStatus) {
      return emptyResponse();
    }

    const { data: messageRow, error: messageError } = await supabaseAdmin
      .from("conversation_messages")
      .select("id")
      .eq("external_id", messageId)
      .maybeSingle();

    if (messageError) {
      throw new Error(messageError.message ?? "Failed to load message");
    }
    if (!messageRow?.id) {
      console.warn("telnyx_sms_status: unknown message id", messageId);
      return emptyResponse();
    }

    await supabaseAdmin
      .from("conversation_messages")
      .update({
        sms_delivery_status: messageStatus,
        sms_error_code: errorCode,
      })
      .eq("id", messageRow.id);

    return emptyResponse();
  } catch (error) {
    console.error("telnyx_sms_status", error);
    const message = error instanceof Error ? error.message : "Webhook failed";
    return createErrorResponse(500, message);
  }
});
