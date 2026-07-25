import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkInboundEmailWebhookAuth } from "../_shared/inboundEmailWebhookAuth.ts";
import { parseSendGridInbound } from "./parseSendGridInbound.ts";
import {
  matchesTicketInbox,
  processTicketInbound,
} from "../postmark/processTicketInbound.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const authError = checkInboundEmailWebhookAuth(req);
  if (authError) return authError;

  try {
    const form = await req.formData();
    const { payload, attachments } = await parseSendGridInbound(form);

    const inbox = await matchesTicketInbox(payload);
    if (!inbox) {
      return new Response("No matching ticket inbox", { status: 403 });
    }

    return await processTicketInbound({ payload, attachments });
  } catch (error) {
    console.error("email_inbound.error", error);
    return new Response(
      error instanceof Error ? error.message : "Inbound email failed",
      { status: 500 },
    );
  }
});
