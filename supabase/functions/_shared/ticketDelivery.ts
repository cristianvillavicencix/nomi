import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { sendTransactionalEmail } from "./transactionalEmail.ts";
import { loadStorageAttachmentsForEmail } from "./storageAttachmentsForEmail.ts";
import {
  buildTicketDeliveredInternalNoteBody,
  buildTicketDeliveryEmailSubject,
} from "./ticketInvoiceFlow.ts";
import { buildTicketDeliveryEmailHtml } from "./ticketEmailTemplates.ts";
import { loadCombinedInvoiceTicketIds } from "./combinedTicketInvoiceFlow.ts";
import { createStorageSignedUrl } from "./storageObjectUrl.ts";
import { supabaseAdmin } from "./supabaseAdmin.ts";

const buildMessageId = (ticketId: number) =>
  `<ticket-${ticketId}-${crypto.randomUUID()}@nomicrm.com>`;

/**
 * Product / provider cap when attaching files in one email.
 * Twilio SendGrid allows ~30 MB total message after Base64.
 */
export const MAX_DELIVERY_EMAIL_BYTES = 25 * 1024 * 1024;
const MAX_DELIVERY_EMAIL_MB = MAX_DELIVERY_EMAIL_BYTES / (1024 * 1024);

/**
 * Edge workers OOM when Base64-encoding multi-MB packs (HTTP 546).
 * Prefer signed download links whenever the pack may exceed this.
 */
const EDGE_SAFE_ATTACH_BYTES = 3 * 1024 * 1024;
const DOWNLOAD_LINK_EXPIRES_SEC = 60 * 60 * 24 * 7; // 7 days

const deliveryEmailFailureReason = (emailResult: {
  skipped?: boolean;
  reason?: string | null;
}) => {
  if (!emailResult.skipped) return null;
  if (emailResult.reason === "channel_paused") {
    return "Ticket email channel is paused. Re-enable it under Settings → Integrations → Mail.";
  }
  return "Delivery email was skipped. Check Communications settings and try Retry delivery.";
};

export async function noteTicketDeliveryFailure(
  supabase: SupabaseClient,
  params: { ticketId: number; error: unknown },
) {
  const detail =
    params.error instanceof Error && params.error.message.trim()
      ? params.error.message.trim()
      : "Unknown error";
  const body =
    `**Automatic delivery failed**\n\n${detail}\n\n` +
    `Open Billing and use **Retry delivery** to send the files again.`;
  try {
    await supabase.from("ticket_messages").insert({
      ticket_id: params.ticketId,
      body,
      direction: "internal",
      from_name: "System",
      created_at: new Date().toISOString(),
    });
  } catch (noteError) {
    console.error("noteTicketDeliveryFailure.failed", noteError);
  }
}

type DeliveryFile = {
  id: number;
  title: string;
  type?: string | null;
  path?: string | null;
  src?: string | null;
  sort_order?: number | null;
};

async function estimatePublicObjectBytes(file: DeliveryFile) {
  const url = file.src?.trim();
  if (!url?.startsWith("http")) return null;
  try {
    const response = await fetch(url, { method: "HEAD" });
    const length = response.headers.get("content-length");
    if (!response.ok || !length) return null;
    const size = Number(length);
    return Number.isFinite(size) && size >= 0 ? size : null;
  } catch {
    return null;
  }
}

async function estimateDeliverableBytes(files: DeliveryFile[]) {
  let total = 0;
  for (const file of files) {
    const size = await estimatePublicObjectBytes(file);
    if (size == null) {
      // Unknown size → avoid loading into the worker; use download links.
      return Number.POSITIVE_INFINITY;
    }
    total += size;
  }
  return total;
}

async function buildDownloadLinks(files: DeliveryFile[]) {
  const links: Array<{ name: string; url: string }> = [];
  for (const file of files) {
    const path = file.path?.trim();
    const name = file.title?.trim() || path?.split("/").pop() || "file";
    if (path) {
      const signed = await createStorageSignedUrl(
        supabaseAdmin,
        "attachments",
        path,
        DOWNLOAD_LINK_EXPIRES_SEC,
      );
      if (signed) {
        links.push({ name, url: signed });
        continue;
      }
    }
    if (file.src?.trim()) {
      links.push({ name, url: file.src.trim() });
      continue;
    }
    throw new Error(
      `Could not create a download link for "${name}". Retry delivery or share the file manually.`,
    );
  }
  if (links.length === 0) {
    throw new Error("Could not create download links for delivery files.");
  }
  return links;
}

async function deliverOneTicketForInvoicePayment(
  supabase: SupabaseClient,
  params: {
    invoiceId: number;
    orgId: number;
    ticketId: number;
    invoiceNumber: string;
  },
) {
  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, org_id, subject, status, inbox_address, requester_email, requester_name, delivery_status, merged_into_ticket_id",
    )
    .eq("id", params.ticketId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!ticket?.id || ticket.merged_into_ticket_id) {
    return {
      delivered: false,
      skipped: true,
      reason: "ticket_missing_or_merged",
    };
  }

  if (ticket.delivery_status === "delivered") {
    const { count: pendingForInvoice } = await supabase
      .from("ticket_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .eq("invoiced_invoice_id", params.invoiceId)
      .is("delivered_at", null);

    if (!pendingForInvoice) {
      return {
        delivered: true,
        skipped: true,
        duplicate: true,
        ticket_id: ticket.id,
      };
    }
  }

  const { data: deliverables } = await supabase
    .from("ticket_deliverables")
    .select("id, title, type, path, src, sort_order")
    .eq("ticket_id", ticket.id)
    .eq("org_id", params.orgId)
    .eq("invoiced_invoice_id", params.invoiceId)
    .is("delivered_at", null)
    .order("sort_order", { ascending: true });

  if (!deliverables?.length) {
    return {
      delivered: false,
      skipped: true,
      reason: "no_deliverables",
      ticket_id: ticket.id,
    };
  }

  const recipient = ticket.requester_email?.trim().toLowerCase() ?? "";
  if (!recipient) {
    return {
      delivered: false,
      skipped: true,
      reason: "missing_recipient",
      ticket_id: ticket.id,
    };
  }

  let inboxAddress = ticket.inbox_address?.trim().toLowerCase() ?? "";
  let fromName = "LBS Supplements";

  if (inboxAddress) {
    const { data: inbox } = await supabase
      .from("ticket_inboxes")
      .select("email, from_name, display_name, is_active")
      .eq("org_id", params.orgId)
      .eq("email", inboxAddress)
      .maybeSingle();
    if (inbox?.is_active === false) {
      return {
        delivered: false,
        skipped: true,
        reason: "inbox_paused",
        ticket_id: ticket.id,
      };
    }
    if (inbox?.from_name?.trim()) fromName = inbox.from_name.trim();
    else if (inbox?.display_name?.trim()) fromName = inbox.display_name.trim();
  } else {
    const { data: defaultInbox } = await supabase
      .from("ticket_inboxes")
      .select("email, from_name, display_name")
      .eq("org_id", params.orgId)
      .eq("is_active", true)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    inboxAddress = defaultInbox?.email?.trim().toLowerCase() ?? "";
    if (defaultInbox?.from_name?.trim())
      fromName = defaultInbox.from_name.trim();
  }

  if (!inboxAddress) {
    return {
      delivered: false,
      skipped: true,
      reason: "missing_inbox",
      ticket_id: ticket.id,
    };
  }

  const now = new Date().toISOString();
  const propertyAddress = ticket.subject?.trim() || "Your property";
  const subject = buildTicketDeliveryEmailSubject(propertyAddress);
  const fileNames = deliverables.map((file) => file.title);
  const fileList = fileNames.join(", ");
  const estimatedBytes = await estimateDeliverableBytes(
    deliverables as DeliveryFile[],
  );
  const useDownloadLinks =
    !Number.isFinite(estimatedBytes) ||
    estimatedBytes > EDGE_SAFE_ATTACH_BYTES;

  let downloadLinks: Array<{ name: string; url: string }> | undefined;
  let emailAttachments:
    | Awaited<ReturnType<typeof loadStorageAttachmentsForEmail>>["attachments"]
    | undefined;

  if (useDownloadLinks) {
    downloadLinks = await buildDownloadLinks(deliverables as DeliveryFile[]);
  } else {
    const loadedAttachments = await loadStorageAttachmentsForEmail(deliverables);
    if (loadedAttachments.missingCount > 0) {
      throw new Error(
        `Could not load ${loadedAttachments.missingCount} of ${loadedAttachments.requestedCount} delivery file(s). Files were not marked as delivered.`,
      );
    }
    if (loadedAttachments.totalBytes > EDGE_SAFE_ATTACH_BYTES) {
      downloadLinks = await buildDownloadLinks(deliverables as DeliveryFile[]);
    } else if (loadedAttachments.totalBytes > MAX_DELIVERY_EMAIL_BYTES) {
      const sizeMb = Math.round(loadedAttachments.totalBytes / (1024 * 1024));
      throw new Error(
        `Delivery files are too large for email (${sizeMb} MB). Maximum is ${MAX_DELIVERY_EMAIL_MB} MB.`,
      );
    } else {
      emailAttachments = loadedAttachments.attachments;
    }
  }

  const textBody = downloadLinks?.length
    ? `Thank you for your payment (${params.invoiceNumber}). ` +
      `Your supplement files for ${propertyAddress} are ready to download (links expire in 7 days):\n` +
      downloadLinks.map((file) => `- ${file.name}: ${file.url}`).join("\n")
    : `Thank you for your payment (${params.invoiceNumber}). ` +
      `Your supplement files for ${propertyAddress} are attached` +
      (fileList ? `: ${fileList}.` : " to this email.");
  const htmlBody = buildTicketDeliveryEmailHtml({
    orgName: fromName,
    invoiceNumber: params.invoiceNumber,
    propertyAddress,
    fileNames,
    downloadLinks,
  });
  const outboundMessageId = buildMessageId(ticket.id);

  const emailResult = await sendTransactionalEmail({
    orgId: params.orgId,
    to: [recipient],
    subject,
    textBody,
    htmlBody,
    fromEmail: inboxAddress,
    fromName,
    replyTo: inboxAddress,
    attachments: emailAttachments,
  });

  const deliveryFailure = deliveryEmailFailureReason(emailResult);
  if (deliveryFailure) {
    throw new Error(deliveryFailure);
  }

  const { data: message, error: messageError } = await supabase
    .from("ticket_messages")
    .insert({
      ticket_id: ticket.id,
      body: textBody,
      html_body: htmlBody,
      direction: "outbound",
      from_email: inboxAddress,
      from_name: fromName,
      to_emails: [recipient],
      external_message_id: outboundMessageId,
      attachments: deliverables,
      created_at: now,
    })
    .select("id")
    .single();

  if (messageError) {
    throw new Error(messageError.message ?? "Could not save delivery message");
  }

  await supabase
    .from("ticket_deliverables")
    .update({ delivered_at: now })
    .eq("ticket_id", ticket.id)
    .eq("org_id", params.orgId)
    .eq("invoiced_invoice_id", params.invoiceId)
    .is("delivered_at", null);

  const [
    { count: undeliveredInvoiced },
    { count: unbilledDeliverables },
    { count: otherSentInvoices },
  ] = await Promise.all([
    supabase
      .from("ticket_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .not("invoiced_invoice_id", "is", null)
      .is("delivered_at", null),
    supabase
      .from("ticket_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .is("invoiced_invoice_id", null),
    supabase
      .from("client_invoices")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .eq("status", "sent")
      .neq("id", params.invoiceId),
  ]);

  const ticketUpdate: {
    updated_at: string;
    status?: string;
    delivery_status?: string;
    delivered_at?: string | null;
  } = { updated_at: now };

  if (
    (undeliveredInvoiced ?? 0) === 0 &&
    (unbilledDeliverables ?? 0) === 0 &&
    (otherSentInvoices ?? 0) === 0
  ) {
    ticketUpdate.status = "resolved";
    ticketUpdate.delivery_status = "delivered";
    ticketUpdate.delivered_at = now;
  } else if ((unbilledDeliverables ?? 0) > 0) {
    ticketUpdate.delivery_status = "ready";
  } else {
    ticketUpdate.delivery_status = "invoice_sent";
  }

  await supabase
    .from("tickets")
    .update(ticketUpdate)
    .eq("id", ticket.id)
    .eq("org_id", params.orgId);

  await supabase.from("ticket_messages").insert({
    ticket_id: ticket.id,
    body: buildTicketDeliveredInternalNoteBody({
      invoiceNumber: params.invoiceNumber,
      propertyAddress: ticket.subject,
      fileCount: deliverables.length,
      recipientEmail: recipient,
    }),
    direction: "internal",
    from_name: "System",
    created_at: now,
  });

  return {
    delivered: true,
    ticket_id: ticket.id,
    message_id: message?.id ?? null,
    email_sent: !emailResult.skipped,
    file_count: deliverables.length,
  };
}

export async function deliverTicketAfterInvoicePayment(
  supabase: SupabaseClient,
  params: {
    invoiceId: number;
    orgId: number;
  },
) {
  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("id, org_id, ticket_id, invoice_number, status")
    .eq("id", params.invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!invoice?.id || invoice.status !== "paid") {
    return { delivered: false, skipped: true, reason: "no_ticket_or_unpaid" };
  }

  const linkedTicketIds = await loadCombinedInvoiceTicketIds(
    supabase,
    params.orgId,
    params.invoiceId,
  );

  let ticketIds = linkedTicketIds;
  if (!ticketIds.length) {
    let ticketId = invoice.ticket_id ? Number(invoice.ticket_id) : null;

    if (!ticketId) {
      const { data: deliverableLink } = await supabase
        .from("ticket_deliverables")
        .select("ticket_id")
        .eq("org_id", params.orgId)
        .eq("invoiced_invoice_id", invoice.id)
        .is("delivered_at", null)
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();

      ticketId = deliverableLink?.ticket_id
        ? Number(deliverableLink.ticket_id)
        : null;
    }

    if (!ticketId) {
      return { delivered: false, skipped: true, reason: "no_ticket" };
    }

    ticketIds = [ticketId];
  }

  const nowIso = new Date().toISOString();
  if (!invoice.ticket_id && ticketIds[0]) {
    await supabase
      .from("client_invoices")
      .update({ ticket_id: ticketIds[0], updated_at: nowIso })
      .eq("id", invoice.id)
      .eq("org_id", params.orgId);
  }

  const results = [];
  for (const ticketId of ticketIds) {
    results.push(
      await deliverOneTicketForInvoicePayment(supabase, {
        invoiceId: params.invoiceId,
        orgId: params.orgId,
        ticketId,
        invoiceNumber: invoice.invoice_number,
      }),
    );
  }

  const deliveredResult = results.find((result) => result.delivered);
  return deliveredResult ?? results[0] ?? { delivered: false, skipped: true };
}
