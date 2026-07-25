import { sendTransactionalEmail } from "./transactionalEmail.ts";
import { expandTicketSettingVariables } from "./ticketWorkspaceSettings.ts";

const DEFAULT_SUBJECT = "We received your request";

const DEFAULT_TEXT = [
  "Thank you for contacting us.",
  "",
  "We received your request and assigned it ticket #{{ticketId}}.",
  "Our team will review it and follow up soon.",
  "",
  "If you meant to reply to an existing ticket, please use Reply on that email thread.",
  "",
  "{{orgName}}",
].join("\n");

const DEFAULT_HTML = `
  <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
    <p>Thank you for contacting us.</p>
    <p>We received your request and assigned it <strong>ticket #{{ticketId}}</strong>.</p>
    <p>Our team will review it and follow up soon.</p>
    <p style="color:#64748b;font-size:13px;">If you meant to reply to an existing ticket, please use Reply on that email thread.</p>
    <p style="color:#64748b;font-size:13px;">{{orgName}}</p>
  </div>`;

export const buildNewTicketAutoReply = (params: {
  orgName: string;
  ticketId: number;
  subject?: string | null;
  textTemplate?: string | null;
  htmlTemplate?: string | null;
}) => {
  const vars = {
    ticketId: String(params.ticketId),
    orgName: params.orgName,
  };
  const subject = expandTicketSettingVariables(
    params.subject?.trim() || DEFAULT_SUBJECT,
    vars,
  );
  const textBody = expandTicketSettingVariables(
    params.textTemplate?.trim() || DEFAULT_TEXT,
    vars,
  );
  const htmlBody = expandTicketSettingVariables(
    params.htmlTemplate?.trim() || DEFAULT_HTML,
    vars,
  );
  return { subject, textBody, htmlBody };
};

export async function sendNewTicketAutoReply(params: {
  orgId: number;
  orgName: string;
  ticketId: number;
  toEmail: string;
  fromEmail: string;
  fromName: string;
  subject?: string | null;
  textTemplate?: string | null;
  htmlTemplate?: string | null;
}) {
  const content = buildNewTicketAutoReply({
    orgName: params.orgName,
    ticketId: params.ticketId,
    subject: params.subject,
    textTemplate: params.textTemplate,
    htmlTemplate: params.htmlTemplate,
  });

  return sendTransactionalEmail({
    orgId: params.orgId,
    orgName: params.orgName,
    to: params.toEmail,
    subject: content.subject,
    textBody: content.textBody,
    htmlBody: content.htmlBody,
    fromEmail: params.fromEmail,
    fromName: params.fromName,
    replyTo: params.fromEmail,
  });
}

export async function sendTicketCsatEmail(params: {
  orgId: number;
  orgName: string;
  ticketId: number;
  toEmail: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  htmlBody: string;
}) {
  return sendTransactionalEmail({
    orgId: params.orgId,
    orgName: params.orgName,
    to: params.toEmail,
    subject: params.subject,
    textBody: params.htmlBody.replace(/<[^>]+>/g, " "),
    htmlBody: params.htmlBody,
    fromEmail: params.fromEmail,
    fromName: params.fromName,
    replyTo: params.fromEmail,
  });
}
