import { LBS_SUPPORT_SIGNATURE } from "@/modules/tickets/ticketReplyTemplates";

export const TICKET_REPLY_SIGNATURE = LBS_SUPPORT_SIGNATURE;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const parseEmailList = (value: string) =>
  value
    .split(/[,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export const isValidEmailList = (emails: string[]) =>
  emails.length > 0 && emails.every((email) => emailPattern.test(email));

export const createDefaultReplyBody = () => `\n\n${TICKET_REPLY_SIGNATURE}`;

export const insertAboveSignature = (body: string, text: string) => {
  const sigIndex = body.indexOf(TICKET_REPLY_SIGNATURE);
  if (sigIndex === -1) {
    const trimmed = body.trim();
    if (!trimmed) return `${text}\n\n${TICKET_REPLY_SIGNATURE}`;
    return `${trimmed}\n\n${text}\n\n${TICKET_REPLY_SIGNATURE}`;
  }

  const before = body.slice(0, sigIndex).trimEnd();
  if (!before) return `${text}\n\n${TICKET_REPLY_SIGNATURE}`;
  return `${before}\n\n${text}\n\n${TICKET_REPLY_SIGNATURE}`;
};

export const stripReplySignature = (body: string) => {
  const trimmed = body.trim();
  if (trimmed === TICKET_REPLY_SIGNATURE) return "";
  if (trimmed.endsWith(TICKET_REPLY_SIGNATURE)) {
    return trimmed
      .slice(0, trimmed.length - TICKET_REPLY_SIGNATURE.length)
      .trimEnd();
  }
  return trimmed;
};

export const hasReplyContent = (body: string) =>
  Boolean(stripReplySignature(body).trim());

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const linkifyLine = (line: string) =>
  escapeHtml(line).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#2563eb;text-decoration:underline;">$1</a>',
  );

export const normalizeOutboundPlainText = (text: string) =>
  text.replace(/\n{3,}/g, "\n\n").trim();

export const plainTextToHtml = (textBody: string) => {
  const normalized = normalizeOutboundPlainText(textBody);
  if (!normalized) return "";

  const paragraphs = normalized.split(/\n{2,}/).filter((paragraph) => paragraph.trim());

  return paragraphs
    .map((paragraph, index) => {
      const lines = paragraph
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0)
        .map(linkifyLine)
        .join("<br/>");
      if (!lines) return "";
      const marginBottom = index < paragraphs.length - 1 ? "12px" : "0";
      return `<p style="margin:0 0 ${marginBottom};">${lines}</p>`;
    })
    .filter(Boolean)
    .join("");
};

export type ForwardMessage = {
  body?: string | null;
  html_body?: string | null;
  from_email?: string | null;
  from_name?: string | null;
  created_at?: string | null;
};

const buildForwardHeaderLines = (
  ticket: { subject?: string },
  message?: ForwardMessage | null,
) => {
  const lines = ["---------- Forwarded message ----------"];

  if (message?.from_email?.trim()) {
    const fromLabel = message.from_name?.trim()
      ? `${message.from_name} <${message.from_email.trim()}>`
      : message.from_email.trim();
    lines.push(`From: ${fromLabel}`);
  }

  if (ticket.subject?.trim()) {
    lines.push(`Subject: ${ticket.subject.trim()}`);
  }

  if (message?.created_at) {
    lines.push(`Date: ${new Date(message.created_at).toLocaleString()}`);
  }

  return lines;
};

export const buildForwardPlainBlock = (
  ticket: { subject?: string },
  message?: ForwardMessage | null,
) => {
  const lines = [
    ...buildForwardHeaderLines(ticket, message),
    "",
    message?.body?.trim() || "(No message body)",
  ];
  return lines.join("\n");
};

export const buildForwardBody = (
  ticket: { subject?: string },
  message?: ForwardMessage | null,
) => `${buildForwardPlainBlock(ticket, message)}\n\n${TICKET_REPLY_SIGNATURE}`;

export const buildForwardHtmlBlock = (
  ticket: { subject?: string },
  message?: ForwardMessage | null,
) => {
  const headerParts = [
    '<p style="margin:0 0 8px;color:#6b7280;font-size:12px;">---------- Forwarded message ----------</p>',
  ];

  if (message?.from_email?.trim()) {
    const fromLabel = message.from_name?.trim()
      ? `${message.from_name} <${message.from_email.trim()}>`
      : message.from_email.trim();
    headerParts.push(
      `<p style="margin:0 0 4px;font-size:13px;"><strong>From:</strong> ${escapeHtml(fromLabel)}</p>`,
    );
  }

  if (ticket.subject?.trim()) {
    headerParts.push(
      `<p style="margin:0 0 4px;font-size:13px;"><strong>Subject:</strong> ${escapeHtml(ticket.subject.trim())}</p>`,
    );
  }

  if (message?.created_at) {
    headerParts.push(
      `<p style="margin:0 0 12px;font-size:13px;"><strong>Date:</strong> ${escapeHtml(new Date(message.created_at).toLocaleString())}</p>`,
    );
  }

  const html = message?.html_body?.trim();
  const bodyHtml = html
    ? `<div class="forwarded-email-body">${html}</div>`
    : `<pre style="margin:0;white-space:pre-wrap;font-family:inherit;font-size:13px;">${escapeHtml(message?.body?.trim() || "(No message body)")}</pre>`;

  return `<div style="margin:16px 0;padding-top:12px;border-top:1px solid #e5e7eb;">${headerParts.join("")}${bodyHtml}</div>`;
};

export const buildOutboundEmailHtml = ({
  userNote,
  forwardHtml,
  includeSignature = true,
}: {
  userNote?: string;
  forwardHtml?: string | null;
  includeSignature?: boolean;
}) => {
  const parts: string[] = [];

  if (userNote?.trim()) {
    parts.push(
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827;">${plainTextToHtml(userNote.trim())}</div>`,
    );
  }

  if (forwardHtml?.trim()) {
    parts.push(forwardHtml.trim());
  }

  if (includeSignature) {
    parts.push(buildSignatureHtml());
  }

  return parts.join("");
};

export const buildSignatureHtml = () =>
  `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#374151;">
    <p style="margin:0 0 6px;font-weight:600;color:#111827;">Latinos Business Support | Marketing Digital, Páginas Web, Xactimate</p>
    <p style="margin:0;">(203) 303-9148 | <a href="mailto:info@lbs.bz" style="color:#2563eb;text-decoration:underline;">info@lbs.bz</a> | <a href="https://www.lbs.bz" style="color:#2563eb;text-decoration:underline;">www.lbs.bz</a></p>
    <p style="margin:6px 0 0;">1200 Summer St, Stamford, 06902 CT</p>
  </div>`;

export const buildReplyOutboundBodies = (body: string) => {
  const textBody = normalizeOutboundPlainText(body.trim() || "(See attachments)");
  const userNote = normalizeOutboundPlainText(stripReplySignature(textBody));
  const includeSignature = textBody.includes(TICKET_REPLY_SIGNATURE);

  const htmlBody = buildOutboundEmailHtml({
    userNote,
    includeSignature,
  });

  return { textBody, htmlBody };
};

export const buildForwardOutboundBodies = ({
  ticket,
  message,
  userNote,
}: {
  ticket: { subject?: string };
  message?: ForwardMessage | null;
  userNote: string;
}) => {
  const forwardPlain = buildForwardPlainBlock(ticket, message);
  const forwardHtml = buildForwardHtmlBlock(ticket, message);
  const trimmedNote = userNote.trim();

  const textBody = normalizeOutboundPlainText(
    trimmedNote
      ? `${trimmedNote}\n\n${forwardPlain}\n\n${TICKET_REPLY_SIGNATURE}`
      : `${forwardPlain}\n\n${TICKET_REPLY_SIGNATURE}`,
  );

  const htmlBody = buildOutboundEmailHtml({
    userNote: normalizeOutboundPlainText(trimmedNote),
    forwardHtml,
    includeSignature: true,
  });

  return { textBody, htmlBody };
};
