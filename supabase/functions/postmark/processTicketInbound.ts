import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import type { Attachment } from "./extractAndUploadAttachments.ts";
import { isOrgTransactionalEmailConfigured } from "../_shared/transactionalEmail.ts";
import { sendNewTicketAutoReply } from "../_shared/ticketInboundAutoReply.ts";
import { INVOICE_ORGANIZATION_NAME } from "../_shared/invoiceOrganizationInfo.ts";
import {
  loadOrgTicketWorkspaceSettings,
  matchRoutingRule,
  nextRoundRobinIndex,
  passesInboundDomainRules,
  resolveRoundRobinAssignee,
  saveOrgTicketWorkspaceSettings,
  shouldIgnoreInboundSender,
} from "../_shared/ticketWorkspaceSettings.ts";
import {
  stripQuotedHtml,
  stripQuotedPlainText,
} from "../_shared/ticketEmailQuotedContent.ts";

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
  StrippedTextReply?: string;
  StrippedHtmlReply?: string;
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
    .select(
      "id, org_id, email, display_name, from_name, postmark_inbound_address, sendgrid_hostname, sendgrid_forward_address, auto_reply_enabled, auto_reply_subject, auto_reply_html, auto_reply_text",
    )
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  return (
    (inboxes ?? []).find((inbox) => {
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
    }) ?? null
  );
};

const findContactByEmail = async (orgId: number, email: string) => {
  const { data: contacts, error } = await supabaseAdmin
    .from("contacts")
    .select("id, company_id, first_name, last_name, email_jsonb")
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);

  const normalized = normalizeEmail(email);
  return (
    (contacts ?? []).find((contact) =>
      (contact.email_jsonb as Array<{ email?: string }> | null)?.some(
        (row) => normalizeEmail(row.email ?? "") === normalized,
      ),
    ) ?? null
  );
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

/** iPhone and other clients often send photo-only mail with an empty text/plain part. */
const escapeHtmlAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export const buildInlineImagesHtml = (attachments: Attachment[]) =>
  attachments
    .filter((file) => file.type?.toLowerCase().startsWith("image/"))
    .map(
      (file) =>
        `<img src="${file.src}" alt="${escapeHtmlAttr(file.title)}" style="max-width:100%;height:auto;display:block;margin:8px 0;" />`,
    )
    .join("");

const collectAddressEmails = (rows: PostmarkAddress[] | undefined) =>
  (rows ?? [])
    .map((row) => row.Email?.trim())
    .filter((email): email is string => Boolean(email))
    .map(normalizeEmail);

/** Replace cid: inline image references with uploaded attachment URLs. */
export const rewriteInlineAttachmentImages = (
  htmlBody: string | null | undefined,
  attachments: Attachment[],
): string | null => {
  if (!htmlBody?.trim() || !attachments.length) return htmlBody?.trim() || null;

  let result = htmlBody;

  for (const attachment of attachments) {
    const contentId = attachment.contentId?.trim();
    if (!contentId) continue;
    const bare = contentId.replace(/^<|>$/g, "").replace(/^cid:/i, "");
    for (const needle of [contentId, `cid:${bare}`, bare, `cid:${bare}@`]) {
      if (!needle) continue;
      result = result.split(needle).join(attachment.src);
    }
  }

  result = result.replace(
    /src=(["']?)cid:([^"'\s>]+)\1/gi,
    (_match, quote, cidValue) => {
      const bareCid = String(cidValue).replace(/^<|>$/g, "");
      const attachment = attachments.find((file) => {
        const id = file.contentId?.trim();
        if (!id) return false;
        const bare = id.replace(/^<|>$/g, "").replace(/^cid:/i, "");
        return (
          id === bareCid ||
          bare === bareCid ||
          bareCid.startsWith(bare) ||
          bare.startsWith(bareCid)
        );
      });
      return attachment ? `src=${quote}${attachment.src}${quote}` : _match;
    },
  );

  return result;
};

const imageAttachments = (attachments: Attachment[]) =>
  attachments.filter((file) => file.type?.toLowerCase().startsWith("image/"));

const mergeHtmlWithInlineImages = (
  htmlBody: string | null,
  attachments: Attachment[],
) => {
  const images = imageAttachments(attachments);
  if (!images.length) return htmlBody;

  const inline = buildInlineImagesHtml(images);
  if (!inline) return htmlBody;

  const block = `<div>${inline}</div>`;
  if (!htmlBody?.trim()) return block;
  if (htmlBody.includes(inline.slice(0, 40))) return htmlBody;
  return `${htmlBody}${block}`;
};

export const buildInboundTicketMessageBody = (
  textBody: string,
  htmlBody: string | null | undefined,
  attachments: Attachment[],
): { body: string; htmlBody: string | null } | null => {
  const trimmedText = textBody.trim();
  const trimmedHtml = htmlBody?.trim() || null;
  const images = imageAttachments(attachments);

  if (trimmedText) {
    const resolvedHtml = mergeHtmlWithInlineImages(
      rewriteInlineAttachmentImages(trimmedHtml, attachments),
      attachments,
    );
    return { body: trimmedText, htmlBody: resolvedHtml };
  }

  if (trimmedHtml) {
    const resolvedHtml = mergeHtmlWithInlineImages(
      rewriteInlineAttachmentImages(trimmedHtml, attachments) ?? trimmedHtml,
      attachments,
    );
    const stripped = resolvedHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { body: stripped || "(See email)", htmlBody: resolvedHtml };
  }

  if (!attachments.length) return null;

  if (images.length === attachments.length && images.length > 0) {
    const inlineHtml = buildInlineImagesHtml(attachments);
    return {
      body:
        images.length === 1
          ? "Photo attached"
          : `${images.length} photos attached`,
      htmlBody: inlineHtml ? `<div>${inlineHtml}</div>` : null,
    };
  }

  if (images.length > 0) {
    const inlineHtml = buildInlineImagesHtml(images);
    return {
      body:
        attachments.length === 1
          ? "1 attachment"
          : `${attachments.length} attachments`,
      htmlBody: inlineHtml ? `<div>${inlineHtml}</div>` : null,
    };
  }

  return {
    body:
      attachments.length === 1
        ? "1 attachment"
        : `${attachments.length} attachments`,
    htmlBody: null,
  };
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

  const workspaceSettings = await loadOrgTicketWorkspaceSettings(inbox.org_id);
  const normalizedFrom = normalizeEmail(fromEmail);
  if (shouldIgnoreInboundSender(normalizedFrom, workspaceSettings)) {
    return new Response(JSON.stringify({ ok: true, ignored: "auto_responder" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!passesInboundDomainRules(normalizedFrom, workspaceSettings)) {
    return new Response(JSON.stringify({ ok: true, ignored: "domain_rule" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const fromName = payload.FromFull?.Name?.trim() || null;
  const subject = payload.Subject?.trim() || "(No subject)";
  const textBody = payload.StrippedTextReply?.trim()
    || stripQuotedPlainText(payload.TextBody?.trim() || "")
    || "";
  const htmlBody = payload.StrippedHtmlReply?.trim()
    || (payload.HtmlBody?.trim() ? stripQuotedHtml(payload.HtmlBody) : null);
  const messageId = payload.MessageID?.trim() || null;
  const inReplyTo = headerValue(payload.Headers, "In-Reply-To");
  const references = headerValue(payload.Headers, "References");
  const toEmails = collectAddressEmails(payload.ToFull);
  const ccEmails = collectAddressEmails(payload.CcFull);

  if (messageId) {
    const { data: duplicate } = await supabaseAdmin
      .from("ticket_messages")
      .select("id, ticket_id")
      .eq("external_message_id", messageId)
      .maybeSingle();
    if (duplicate?.ticket_id) {
      return new Response(
        JSON.stringify({
          ok: true,
          ticket_id: duplicate.ticket_id,
          duplicate: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const messageContent = buildInboundTicketMessageBody(
    textBody,
    htmlBody,
    attachments,
  );
  if (!messageContent) {
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
    const routingRule = matchRoutingRule(subject, workspaceSettings);
    let assigneeId = workspaceSettings.default_assignee_member_id;
    if (routingRule?.assignee_member_id) {
      assigneeId = routingRule.assignee_member_id;
    } else if (workspaceSettings.round_robin_enabled) {
      assigneeId = resolveRoundRobinAssignee(workspaceSettings);
    }
    const priority =
      routingRule?.priority?.trim() ||
      workspaceSettings.default_priority ||
      "normal";
    const tags = routingRule?.tag?.trim()
      ? [routingRule.tag.trim()]
      : [];
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .insert({
        org_id: inbox.org_id,
        company_id: contact?.company_id ?? null,
        contact_id: contact?.id ?? null,
        assignee_id: assigneeId,
        subject,
        status: workspaceSettings.default_status || "new",
        priority,
        tags,
        inbox_address: inbox.email,
        requester_email: normalizedFrom,
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

    if (workspaceSettings.round_robin_enabled) {
      await saveOrgTicketWorkspaceSettings(inbox.org_id, {
        round_robin_index: nextRoundRobinIndex(workspaceSettings),
      });
    }
  } else {
    const { data: existingTicket } = await supabaseAdmin
      .from("tickets")
      .select("contact_id, company_id")
      .eq("id", ticketId)
      .eq("org_id", inbox.org_id)
      .maybeSingle();

    const ticketUpdate: Record<string, unknown> = {
      status: "open",
      updated_at: now,
    };

    if (contact && !existingTicket?.contact_id) {
      ticketUpdate.contact_id = contact.id;
      ticketUpdate.company_id = contact.company_id ?? null;
      if (fromName) {
        ticketUpdate.requester_name = fromName;
      }
    }

    await supabaseAdmin
      .from("tickets")
      .update(ticketUpdate)
      .eq("id", ticketId)
      .eq("org_id", inbox.org_id);
  }

  const { error: messageError } = await supabaseAdmin
    .from("ticket_messages")
    .insert({
      ticket_id: ticketId,
      body: messageContent.body,
      html_body: messageContent.htmlBody,
      direction: "inbound",
      from_email: normalizeEmail(fromEmail),
      from_name: fromName,
      to_emails: toEmails.length ? toEmails : [normalizeEmail(inbox.email)],
      cc_emails: ccEmails,
      external_message_id: messageId,
      attachments,
      created_at: now,
    });

  if (messageError) {
    throw new Error(messageError.message);
  }

  if (isNewTicket) {
    try {
      const inboxRow = inbox as {
        auto_reply_enabled?: boolean;
        auto_reply_subject?: string | null;
        auto_reply_html?: string | null;
        auto_reply_text?: string | null;
      };
      if (inboxRow.auto_reply_enabled !== false) {
        const configured = await isOrgTransactionalEmailConfigured(inbox.org_id);
        if (configured) {
          const replyFromName =
            inbox.from_name?.trim() ||
            inbox.display_name?.trim() ||
            "Support";
          const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("name")
            .eq("id", inbox.org_id)
            .maybeSingle();
          await sendNewTicketAutoReply({
            orgId: inbox.org_id,
            orgName: org?.name?.trim() || INVOICE_ORGANIZATION_NAME,
            ticketId: Number(ticketId),
            toEmail: normalizedFrom,
            fromEmail: normalizeEmail(inbox.email),
            fromName: replyFromName,
            subject: inboxRow.auto_reply_subject,
            textTemplate: inboxRow.auto_reply_text,
            htmlTemplate: inboxRow.auto_reply_html,
          });
        }
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
