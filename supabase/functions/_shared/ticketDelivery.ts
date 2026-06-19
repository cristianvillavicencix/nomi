import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { sendTransactionalEmail } from "./transactionalEmail.ts";
import { loadStorageAttachmentsForEmail } from "./storageAttachmentsForEmail.ts";
import {
  buildTicketDeliveredInternalNoteBody,
  buildTicketDeliveryEmailSubject,
} from "./ticketInvoiceFlow.ts";

const buildMessageId = (ticketId: number) =>
  `<ticket-${ticketId}-${crypto.randomUUID()}@nomicrm.com>`;

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

  if (!invoice?.ticket_id || invoice.status !== "paid") {
    return { delivered: false, skipped: true, reason: "no_ticket_or_unpaid" };
  }

  const ticketId = Number(invoice.ticket_id);

  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, org_id, subject, status, inbox_address, requester_email, requester_name, delivery_status, merged_into_ticket_id",
    )
    .eq("id", ticketId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!ticket?.id || ticket.merged_into_ticket_id) {
    return { delivered: false, skipped: true, reason: "ticket_missing_or_merged" };
  }

  if (ticket.delivery_status === "delivered") {
    const { count: pendingForInvoice } = await supabase
      .from("ticket_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .eq("invoiced_invoice_id", invoice.id)
      .is("delivered_at", null);

    if (!pendingForInvoice) {
      return { delivered: true, skipped: true, duplicate: true };
    }
  }

  const { data: deliverables } = await supabase
    .from("ticket_deliverables")
    .select("id, title, type, path, src, sort_order")
    .eq("ticket_id", ticket.id)
    .eq("org_id", params.orgId)
    .eq("invoiced_invoice_id", invoice.id)
    .is("delivered_at", null)
    .order("sort_order", { ascending: true });

  if (!deliverables?.length) {
    return { delivered: false, skipped: true, reason: "no_deliverables" };
  }

  const recipient = ticket.requester_email?.trim().toLowerCase() ?? "";
  if (!recipient) {
    return { delivered: false, skipped: true, reason: "missing_recipient" };
  }

  let inboxAddress = ticket.inbox_address?.trim().toLowerCase() ?? "";
  let fromName = "LBS Supplements";

  if (inboxAddress) {
    const { data: inbox } = await supabase
      .from("ticket_inboxes")
      .select("email, from_name, display_name")
      .eq("org_id", params.orgId)
      .eq("email", inboxAddress)
      .maybeSingle();
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
    if (defaultInbox?.from_name?.trim()) fromName = defaultInbox.from_name.trim();
  }

  if (!inboxAddress) {
    return { delivered: false, skipped: true, reason: "missing_inbox" };
  }

  const now = new Date().toISOString();
  const propertyAddress = ticket.subject?.trim() || "Your property";
  const subject = buildTicketDeliveryEmailSubject(propertyAddress);
  const fileList = deliverables.map((file) => file.title).join(", ");
  const textBody =
    `Thank you for your payment (${invoice.invoice_number}). ` +
    `Your supplement files for ${propertyAddress} are attached` +
    (fileList ? `: ${fileList}.` : " to this email.");
  const htmlBody =
    `<p>Thank you for your payment (<strong>${invoice.invoice_number}</strong>).</p>` +
    `<p>Your supplement files for <strong>${propertyAddress}</strong> are attached to this email:</p>` +
    (deliverables.length
      ? `<ul>${deliverables
          .map((file) => `<li>${file.title}</li>`)
          .join("")}</ul>`
      : "<p>Your supplement files are attached to this email.</p>");
  const outboundMessageId = buildMessageId(ticket.id);
  const emailAttachments = await loadStorageAttachmentsForEmail(deliverables);

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
    .eq("invoiced_invoice_id", invoice.id)
    .is("delivered_at", null);

  await supabase
    .from("tickets")
    .update({
      status: "resolved",
      delivery_status: "delivered",
      delivered_at: now,
      updated_at: now,
    })
    .eq("id", ticket.id)
    .eq("org_id", params.orgId);

  await supabase.from("ticket_messages").insert({
    ticket_id: ticket.id,
    body: buildTicketDeliveredInternalNoteBody({
      invoiceNumber: invoice.invoice_number,
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
