import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { findOrgByTwilioPhone } from "../_shared/messagingSettings.ts";
import {
  ensureClientConversation,
  insertSmsMessage,
} from "../_shared/messagingConversations.ts";
import { validateTwilioSignatureForRequest } from "../_shared/twilio.ts";
import {
  extractTwilioMediaUrls,
  mirrorTwilioMediaToStorage,
} from "../_shared/twilioMedia.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

/** Twilio expects TwiML; plain text (e.g. "OK") can be sent back to the sender as an SMS. */
const emptyTwimlResponse = () =>
  new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });

const parseFormBody = async (req: Request) => {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const record: Record<string, string> = {};
  params.forEach((value, key) => {
    record[key] = value;
  });
  return record;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return createErrorResponse(405, "Method not allowed");
  }

  try {
    const params = await parseFormBody(req);
    const fromPhone = params.From?.trim();
    const toPhone = params.To?.trim();
    const body = params.Body?.trim() ?? "";
    const messageSid = params.MessageSid?.trim();
    const mediaUrls = extractTwilioMediaUrls(params);

    if (!fromPhone || !toPhone || (!body && mediaUrls.length === 0)) {
      return createErrorResponse(400, "Missing Twilio payload fields");
    }

    const orgSettings = await findOrgByTwilioPhone(toPhone);
    if (!orgSettings?.org_id) {
      return createErrorResponse(404, "Unknown Twilio number");
    }

    const authToken = orgSettings.twilio_auth_token?.trim();
    if (!authToken) {
      return createErrorResponse(403, "Twilio auth token not configured");
    }

    const accountSid = params.AccountSid?.trim();
    const storedAccountSid = orgSettings.twilio_account_sid?.trim();

    const signature = req.headers.get("X-Twilio-Signature");
    let validSignature = await validateTwilioSignatureForRequest(
      authToken,
      signature,
      req,
      params,
    );

    if (
      !validSignature &&
      accountSid &&
      storedAccountSid &&
      accountSid === storedAccountSid
    ) {
      console.warn(
        "twilio_inbound_sms: signature mismatch, accepted via AccountSid match",
        { accountSid, toPhone, fromPhone },
      );
      validSignature = true;
    }

    if (!validSignature) {
      return createErrorResponse(403, "Invalid Twilio signature");
    }

    const conversation = await ensureClientConversation({
      orgId: Number(orgSettings.org_id),
      externalPhone: fromPhone,
    });

    if (messageSid) {
      const { data: existing } = await supabaseAdmin
        .from("conversation_messages")
        .select("id")
        .eq("external_id", messageSid)
        .maybeSingle();

      if (existing?.id) {
        return emptyTwimlResponse();
      }
    }

    let storedMediaUrl: string | null = null;
    if (mediaUrls[0]) {
      const accountSidForMedia =
        accountSid && storedAccountSid && accountSid === storedAccountSid
          ? accountSid
          : storedAccountSid;
      if (accountSidForMedia) {
        storedMediaUrl = await mirrorTwilioMediaToStorage({
          accountSid: accountSidForMedia,
          authToken,
          mediaUrl: mediaUrls[0],
        });
      }
    }

    const messageBody =
      body ||
      (mediaUrls.some((url) => /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url))
        ? "Photo"
        : "Attachment");

    await insertSmsMessage({
      conversationId: Number(conversation.id),
      body: messageBody,
      direction: "inbound",
      externalId: messageSid ?? null,
      mediaUrl: storedMediaUrl,
    });

    return emptyTwimlResponse();
  } catch (error) {
    console.error("twilio_inbound_sms", error);
    const message = error instanceof Error ? error.message : "Webhook failed";
    return createErrorResponse(500, message);
  }
});
