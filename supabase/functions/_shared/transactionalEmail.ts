export type EmailAttachment = {
  name: string;
  contentBase64: string;
  contentType: string;
};

const getTwilioSendGridApiKey = () =>
  Deno.env.get("TWILIO_SENDGRID_API_KEY")?.trim() ??
  Deno.env.get("SENDGRID_API_KEY")?.trim();

const getTwilioSendGridFromEmail = () =>
  Deno.env.get("TWILIO_SENDGRID_FROM_EMAIL")?.trim() ??
  Deno.env.get("SENDGRID_FROM_EMAIL")?.trim();

const isSkipFlagOn = (value: string | undefined) => {
  const flag = value?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
};

export const isTransactionalEmailSkipped = () =>
  isSkipFlagOn(Deno.env.get("SKIP_TRANSACTIONAL_EMAIL")) ||
  isSkipFlagOn(Deno.env.get("SKIP_POSTMARK_EMAIL"));

export type TransactionalEmailProvider = "twilio";

export const getAvailableTransactionalEmailProviders =
  (): TransactionalEmailProvider[] =>
    getTwilioSendGridApiKey() && getTwilioSendGridFromEmail() ? ["twilio"] : [];

export const getTransactionalEmailProvider = ():
  | TransactionalEmailProvider
  | null => getAvailableTransactionalEmailProviders()[0] ?? null;

export const getTransactionalFromEmail = () =>
  getTwilioSendGridFromEmail() ?? null;

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

const formatEmailSendFailure = (message: string) => {
  const lower = message.toLowerCase();

  if (
    lower.includes("verified") ||
    lower.includes("sender identity") ||
    lower.includes("from address")
  ) {
    return (
      "Twilio SendGrid sender is not verified. In Twilio Console → Email, verify your domain " +
      "and set TWILIO_SENDGRID_FROM_EMAIL on Supabase to a verified address (e.g. billing@lbs.bz)."
    );
  }

  return message;
};

async function sendViaTwilioSendGrid(params: {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
}) {
  const apiKey = getTwilioSendGridApiKey();
  const fromRaw = getTwilioSendGridFromEmail();
  if (!apiKey || !fromRaw) {
    throw new Error(
      "Twilio SendGrid is not configured (TWILIO_SENDGRID_API_KEY / TWILIO_SENDGRID_FROM_EMAIL).",
    );
  }

  const from = parseEmailAddress(fromRaw);
  const body: Record<string, unknown> = {
    personalizations: [
      {
        to: [{ email: params.to }],
      },
    ],
    from: {
      email: from.email,
      ...(from.name ? { name: from.name } : {}),
    },
    subject: params.subject,
    content: [
      { type: "text/plain", value: params.textBody },
      { type: "text/html", value: params.htmlBody },
    ],
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
      content: file.contentBase64,
      filename: file.name,
      type: file.contentType,
      disposition: "attachment",
    }));
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      formatEmailSendFailure(
        `Could not send email via Twilio SendGrid (${res.status}) ${text}`,
      ),
    );
  }

  return { provider: "twilio" as const };
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

  if (!isTransactionalEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set TWILIO_SENDGRID_API_KEY and TWILIO_SENDGRID_FROM_EMAIL on Supabase.",
    );
  }

  const htmlBody = textToHtml(params.textBody);
  const result = await sendViaTwilioSendGrid({ ...params, htmlBody });
  return { skipped: false as const, ...result };
}
