import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkInboundEmailWebhookAuth } from "../_shared/inboundEmailWebhookAuth.ts";
import {
  buildSendGridInboundPayload,
  uploadSendGridAttachments,
} from "./parseSendGridInbound.ts";
import {
  matchesTicketInbox,
  processTicketInbound,
} from "../postmark/processTicketInbound.ts";
import { resolveMaxInboundAttachmentBytes } from "../_shared/inboundAttachmentLimits.ts";
import { loadOrgTicketWorkspaceSettings } from "../_shared/ticketWorkspaceSettings.ts";
import { logTicketInboundFailure } from "../_shared/ticketInboundFailures.ts";
import { serializeInboundPayloadForRetry } from "../_shared/inboundPayloadRetry.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const authError = checkInboundEmailWebhookAuth(req);
  if (authError) return authError;

  let payload: ReturnType<typeof buildSendGridInboundPayload> | null = null;

  try {
    const form = await req.formData();
    payload = buildSendGridInboundPayload(form);

    const inbox = await matchesTicketInbox(payload);
    if (!inbox) {
      return new Response("No matching ticket inbox", { status: 403 });
    }

    const workspaceSettings = await loadOrgTicketWorkspaceSettings(inbox.org_id);
    const maxBytes = resolveMaxInboundAttachmentBytes(
      workspaceSettings.max_inbound_attachment_bytes,
    );
    const { attachments, skippedAttachments } = await uploadSendGridAttachments(
      form,
      maxBytes,
    );

    return await processTicketInbound({
      payload,
      attachments,
      skippedAttachments,
      source: "sendgrid",
    });
  } catch (error) {
    console.error("email_inbound.error", error);
    const message = error instanceof Error ? error.message : "Inbound email failed";
    if (payload) {
      const inbox = await matchesTicketInbox(payload).catch(() => null);
      if (inbox) {
        await logTicketInboundFailure(supabaseAdmin, {
          orgId: inbox.org_id,
          inboxId: inbox.id,
          fromEmail: payload.FromFull?.Email ?? null,
          fromName: payload.FromFull?.Name ?? null,
          subject: payload.Subject ?? null,
          errorMessage: message,
          errorCode: "processing_failed",
          externalMessageId: payload.MessageID ?? null,
          source: "sendgrid",
          rawPayload: serializeInboundPayloadForRetry(payload),
        });
      }
    }
    return new Response(message, { status: 500 });
  }
});
