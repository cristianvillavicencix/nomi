export type EmailAttachment = {
  name: string;
  contentBase64: string;
  contentType: string;
};

const getMailerSendApiToken = () =>
  Deno.env.get("MAILERSEND_API_TOKEN")?.trim();
const getMailerSendFromEmail = () =>
  Deno.env.get("MAILERSEND_FROM_EMAIL")?.trim();

const getResendApiKey = () => Deno.env.get("RESEND_API_KEY")?.trim();
const getResendFromEmail = () => Deno.env.get("RESEND_FROM_EMAIL")?.trim();

const getPostmarkServerToken = () =>
  Deno.env.get("POSTMARK_SERVER_TOKEN")?.trim();
const getPostmarkFromEmail = () => Deno.env.get("POSTMARK_FROM_EMAIL")?.trim();

const isSkipFlagOn = (value: string | undefined) => {
  const flag = value?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
};

export const isTransactionalEmailSkipped = () =>
  isSkipFlagOn(Deno.env.get("SKIP_TRANSACTIONAL_EMAIL")) ||
  isSkipFlagOn(Deno.env.get("SKIP_POSTMARK_EMAIL"));

export type TransactionalEmailProvider = "mailersend" | "resend" | "postmark";

export const getTransactionalEmailProvider = ():
  | TransactionalEmailProvider
  | null => {
  if (getMailerSendApiToken() && getMailerSendFromEmail()) return "mailersend";
  if (getResendApiKey() && getResendFromEmail()) return "resend";
  if (getPostmarkServerToken() && getPostmarkFromEmail()) return "postmark";
  return null;
};

export const getTransactionalFromEmail = () =>
  getMailerSendFromEmail() ??
  getResendFromEmail() ??
  getPostmarkFromEmail() ??
  null;

export const isTransactionalEmailConfigured = () =>
  Boolean(getTransactionalEmailProvider());

const escapeHtml = (value: string) =>
  value.replace(/</g, "&lt;").replace(/>/g, "&gt;");

const textToHtml = (textBody: string) =>
  textBody
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

const parseEmailAddress = (value: string) => {
  const trimmed = value.trim();
  const angle = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    const name = angle[1].replace(/^["']|["']$/g, "").trim();
    return { email: angle[2].trim(), name: name || undefined };
  }
  return { email: trimmed };
};

async function sendViaMailerSend(params: {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
}) {
  const apiToken = getMailerSendApiToken();
  const fromRaw = getMailerSendFromEmail();
  if (!apiToken || !fromRaw) {
    throw new Error(
      "MailerSend is not configured (MAILERSEND_API_TOKEN / MAILERSEND_FROM_EMAIL).",
    );
  }

  const from = parseEmailAddress(fromRaw);
  const body: Record<string, unknown> = {
    from: {
      email: from.email,
      ...(from.name ? { name: from.name } : {}),
    },
    to: [{ email: params.to }],
    subject: params.subject,
    text: params.textBody,
    html: params.htmlBody,
  };

  if (params.replyTo?.trim()) {
    const replyTo = parseEmailAddress(params.replyTo);
    body.reply_to = {
      email: replyTo.email,
      ...(replyTo.name ? { name: replyTo.name } : {}),
    };
  }

  if (params.attachments?.length) {
    body.attachments = params.attachments.map((file) => ({
      filename: file.name,
      content: file.contentBase64,
      disposition: "attachment",
    }));
  }

  const res = await fetch("https://api.mailersend.com/v1/email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Could not send email via MailerSend (${res.status}) ${text}`,
    );
  }

  return { provider: "mailersend" as const };
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
}) {
  const apiKey = getResendApiKey();
  const from = getResendFromEmail();
  if (!apiKey || !from) {
    throw new Error(
      "Resend is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).",
    );
  }

  const body: Record<string, unknown> = {
    from,
    to: [params.to],
    subject: params.subject,
    text: params.textBody,
    html: params.htmlBody,
  };

  if (params.replyTo?.trim()) {
    body.reply_to = params.replyTo.trim();
  }

  if (params.attachments?.length) {
    body.attachments = params.attachments.map((file) => ({
      filename: file.name,
      content: file.contentBase64,
      content_type: file.contentType,
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Could not send email via Resend (${res.status}) ${text}`);
  }

  return { provider: "resend" as const };
}

async function sendViaPostmark(params: {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
}) {
  const token = getPostmarkServerToken();
  const from = getPostmarkFromEmail();
  if (!token || !from) {
    throw new Error(
      "Postmark is not configured (POSTMARK_SERVER_TOKEN / POSTMARK_FROM_EMAIL).",
    );
  }

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: params.to,
      Subject: params.subject,
      TextBody: params.textBody,
      HtmlBody: params.htmlBody,
      ReplyTo: params.replyTo?.trim() || undefined,
      Attachments: (params.attachments ?? []).map((file) => ({
        Name: file.name,
        Content: file.contentBase64,
        ContentType: file.contentType,
        ContentID: null,
      })),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Could not send email via Postmark (${res.status}) ${text}`);
  }

  return { provider: "postmark" as const };
}

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  textBody: string;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
}) {
  if (isTransactionalEmailSkipped()) {
    console.warn(
      "transactional_email.skip",
      "Email delivery skipped (SKIP_TRANSACTIONAL_EMAIL)",
    );
    return { skipped: true as const, provider: null };
  }

  const provider = getTransactionalEmailProvider();
  if (!provider) {
    throw new Error(
      "Email is not configured. Set MAILERSEND_API_TOKEN and MAILERSEND_FROM_EMAIL on Supabase.",
    );
  }

  const htmlBody = textToHtml(params.textBody);
  const sendParams = { ...params, htmlBody };

  if (provider === "mailersend") {
    const result = await sendViaMailerSend(sendParams);
    return { skipped: false as const, ...result };
  }

  if (provider === "resend") {
    const result = await sendViaResend(sendParams);
    return { skipped: false as const, ...result };
  }

  const result = await sendViaPostmark(sendParams);
  return { skipped: false as const, ...result };
}
