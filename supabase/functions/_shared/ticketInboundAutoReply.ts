import { sendTransactionalEmail } from "./transactionalEmail.ts";

export const buildNewTicketAutoReply = (params: {
  orgName: string;
  ticketId: number;
}) => ({
  subject: "We received your supplement request",
  textBody: [
    "Thank you for contacting us.",
    "",
    "We received your supplement request and assigned it ticket #" +
      params.ticketId +
      ".",
    "Our team will review your request and send you a secure payment link when your supplement is ready.",
    "Your files will be delivered automatically by email after payment.",
    "",
    "If this is a new request, no further action is needed. If you meant to reply to an existing ticket, please use Reply on that email thread.",
    "",
    params.orgName,
  ].join("\n"),
  htmlBody: `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
      <p>Thank you for contacting us.</p>
      <p>We received your supplement request and assigned it <strong>ticket #${params.ticketId}</strong>.</p>
      <p>Our team will review your request and send you a secure payment link when your supplement is ready.</p>
      <p><strong>Your files will be delivered automatically by email after payment.</strong></p>
      <p style="color:#64748b;font-size:13px;">If this is a new request, no further action is needed. If you meant to reply to an existing ticket, please use Reply on that email thread.</p>
      <p style="color:#64748b;font-size:13px;">${params.orgName}</p>
    </div>`,
});

export async function sendNewTicketAutoReply(params: {
  orgId: number;
  orgName: string;
  ticketId: number;
  toEmail: string;
  fromEmail: string;
  fromName: string;
}) {
  const content = buildNewTicketAutoReply({
    orgName: params.orgName,
    ticketId: params.ticketId,
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
