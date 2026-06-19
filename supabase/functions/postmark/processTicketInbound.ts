import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import type { Attachment } from "./extractAndUploadAttachments.ts";
import { isOrgTransactionalEmailConfigured } from "../_shared/transactionalEmail.ts";
import { sendNewTicketAutoReply } from "../_shared/ticketInboundAutoReply.ts";
import { INVOICE_ORGANIZATION_NAME } from "../_shared/invoiceOrganizationInfo.ts";

type PostmarkAddress = {
  Email?: string;
  Name?: string;
};

type PostmarkHeader = {
  Name?: string;
  Value?: string;
};

export type PostmarkInboundPayload = {
  MessageID?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  FromFull?: PostmarkAddress;
  ToFull?: PostmarkAddress[];
  CcFull?: PostmarkAddress[];
  OriginalRecipient?: string;
  Headers?: PostmarkHeader[];
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const extractEmailsFromHeaderValue = (value: string) => {
  const emails: string[] = [];
  const angleMatches = value.matchAll(/<([^>]+@[^>]+)>/g);
  for (const match of angleMatches) {
    if (match[1]?.trim()) emails.push(normalizeEmail(match[1]));
  }
  if (!emails.length) {
    const bareMatches = value.matchAll(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    );
    for (const match of bareMatches) {
      if (match[0]?.trim()) emails.push(normalizeEmail(match[0]));
    }
  }
  return emails;
};

const collectRecipientEmails = (payload: PostmarkInboundPayload) => {
  const emails = new Set<string>();
  for (const row of payload.ToFull ?? []) {
    if (row.Email?.trim()) emails.add(normalizeEmail(row.Email));
  }
  for (const row of payload.CcFull ?? []) {
    if (row.Email?.trim()) emails.add(normalizeEmail(row.Email));
  }
  if (payload.OriginalRecipient?.trim()) {
    emails.add(normalizeEmail(payload.OriginalRecipient));
  }
  const forwardedHeaderNames = new Set([
    "to",
    "delivered-to",
    "x-original-to",
    "x-forwarded-to",
    "envelope-to",
  ]);
  for (const header of payload.Headers ?? []) {
    const name = header.Name?.trim().toLowerCase();
    const value = header.Value?.trim();
    if (!name || !value || !forwardedHeaderNames.has(name)) continue;
    for (const email of extractEmailsFromHeaderValue(value)) {
      emails.add(email);
    }
  }
  return emails;
};

const headerValue = (headers: PostmarkHeader[] | undefined, name: string) =>
  headers
    ?.find((entry) => entry.Name?.toLowerCase() === name.toLowerCase())
    ?.Value?.trim() ?? null;

const findInbox = async (recipientEmails: Set<string>) => {
  const { data: inboxes, error } = await supabaseAdmin
    .from("ticket_inboxes")
    .select("id, org_id, email, display_name, from_name, postmark_inbound_address, sendgrid_hostname, sendgrid_forward_address")
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  return (inboxes ?? []).find((inbox) => {
    if (recipientEmails.has(normalizeEmail(inbox.email))) return true;
    const inbound = inbox.postmark_inbound_address?.trim();
    if (inbound && recipientEmails.has(normalizeEmail(inbound))) return true;
    const forward = (
      inbox as { sendgrid_forward_address?: string | null }
    ).sendgrid_forward_address?.trim();
    if (forward && recipientEmails.has(normalizeEmail(forward))) return true;
    const hostname = (
      inbox as { sendgrid_hostname?: string | null }
    ).sendgrid_hostname?.trim();
    if (hostname) {
      const suffix = `@${normalizeEmail(hostname)}`;
      if ([...recipientEmails].some((email) => email.endsWith(suffix))) {
        return true;
      }
    }
    return false;
  }) ?? null;
};

const findContactByEmail = async (orgId: number, email: string) => {
  const { data: contacts, error } = await supabaseAdmin
    .from("contacts")
    .select("id, company_id, first_name, last_name, email_jsonb")
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);

  const normalized = normalizeEmail(email);
  return (contacts ?? []).find((contact) =>
    (contact.email_jsonb as Array<{ email?: string }> | null)?.some(
      (row) => normalizeEmail(row.email ?? "") === normalized,
    )
  ) ?? null;
};

const findTicketForThread = async (
  orgId: number,
  inReplyTo: string | null,
  references: string | null,
) => {
  const ids = new Set<string>();
  if (inReplyTo) ids.add(inReplyTo);
  if (references) {
    for (const token of references.split(/\s+/)) {
      if (token.trim()) ids.add(token.trim());
    }
  }

  if (!ids.size) return null;

  const idList = Array.from(ids);

  const { data: messages, error } = await supabaseAdmin
    .from("ticket_messages")
    .select("ticket_id, external_message_id")
    .in("external_message_id", idList);

  if (error) throw new Error(error.message);

  for (const message of messages ?? []) {
    if (!message.ticket_id) continue;
    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select("id, merged_into_ticket_id")
      .eq("id", message.ticket_id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (ticket) return ticket.merged_into_ticket_id ?? ticket.id;
  }

  const { data: threadTicket, error: ticketError } = await supabaseAdmin
    .from("tickets")
    .select("id, merged_into_ticket_id")
    .eq("org_id", orgId)
    .in("external_thread_id", idList)
    .limit(1)
    .maybeSingle();

  if (ticketError) throw new Error(ticketError.message);
  return threadTicket?.merged_into_ticket_id ?? threadTicket?.id ?? null;
};

export const matchesTicketInbox = async (payload: PostmarkInboundPayload) => {
  const recipients = collectRecipientEmails(payload);
  if (!recipients.size) return null;
  return findInbox(recipients);
};

export const processTicketInbound = async ({
  payload,
  attachments,
}: {
  payload: PostmarkInboundPayload;
  attachments: Attachment[];
}) => {
  const recipients = collectRecipientEmails(payload);
  const inbox = await findInbox(recipients);
  if (!inbox) {
    return new Response("No matching ticket inbox", { status: 403 });
  }

  const fromEmail = payload.FromFull?.Email?.trim();
  if (!fromEmail) {
    return new Response("Missing From email", { status: 403 });
  }

  const fromName = payload.FromFull?.Name?.trim() || null;
  const subject = payload.Subject?.trim() || "(No subject)";
  const textBody = payload.TextBody?.trim() || "";
  const htmlBody = payload.HtmlBody?.trim() || null;
  const messageId = payload.MessageID?.trim() || null;
  const inReplyTo = headerValue(payload.Headers, "In-Reply-To");
  const references = headerValue(payload.Headers, "References");

  if (!textBody && !htmlBody) {
    return new Response("Missing email body", { status: 403 });
  }

  const contact = await findContactByEmail(inbox.org_id, fromEmail);
  const existingTicketId = await findTicketForThread(
    inbox.org_id,
    inReplyTo,
    references,
  );

  const now = new Date().toISOString();
  let ticketId = existingTicketId;
  let isNewTicket = false;

  if (!ticketId) {
    isNewTicket = true;
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .insert({
        org_id: inbox.org_id,
        company_id: contact?.company_id ?? null,
        contact_id: contact?.id ?? null,
        subject,
        status: "new",
        priority: "normal",
        inbox_address: inbox.email,
        requester_email: normalizeEmail(fromEmail),
        requester_name: fromName,
        external_thread_id: messageId,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (ticketError || !ticket) {
      throw new Error(ticketError?.message ?? "Could not create ticket");
    }
    ticketId = ticket.id;
  } else {
    await supabaseAdmin
      .from("tickets")
      .update({
        status: "open",
        updated_at: now,
      })
      .eq("id", ticketId)
      .eq("org_id", inbox.org_id);
  }

  const { error: messageError } = await supabaseAdmin
    .from("ticket_messages")
    .insert({
      ticket_id: ticketId,
      body: textBody || htmlBody?.replace(/<[^>]+>/g, " ") || "",
      html_body: htmlBody,
      direction: "inbound",
      from_email: normalizeEmail(fromEmail),
      from_name: fromName,
      to_emails: [normalizeEmail(inbox.email)],
      external_message_id: messageId,
      attachments,
      created_at: now,
    });

  if (messageError) {
    throw new Error(messageError.message);
  }

  if (isNewTicket) {
    try {
      const configured = await isOrgTransactionalEmailConfigured(inbox.org_id);
      if (configured) {
        const fromName =
          inbox.from_name?.trim() ||
          inbox.display_name?.trim() ||
          "LBS Supplements";
        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("name")
          .eq("id", inbox.org_id)
          .maybeSingle();
        await sendNewTicketAutoReply({
          orgId: inbox.org_id,
          orgName: org?.name?.trim() || INVOICE_ORGANIZATION_NAME,
          ticketId: Number(ticketId),
          toEmail: normalizeEmail(fromEmail),
          fromEmail: normalizeEmail(inbox.email),
          fromName,
        });
      }
    } catch (error) {
      console.error("processTicketInbound.auto_reply", error);
    }
  }

  return new Response(JSON.stringify({ ok: true, ticket_id: ticketId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
