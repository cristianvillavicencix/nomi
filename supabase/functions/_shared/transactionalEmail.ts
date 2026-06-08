export type EmailAttachment = {
  name: string;
  contentBase64: string;
  contentType: string;
};

const getTwilioAccountSid = () =>
  Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();

const getTwilioAuthToken = () => Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();

const getTwilioEmailFrom = () =>
  Deno.env.get("TWILIO_EMAIL_FROM")?.trim() ??
  Deno.env.get("TWILIO_SENDGRID_FROM_EMAIL")?.trim();

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
    getTwilioAccountSid() && getTwilioAuthToken() && getTwilioEmailFrom()
      ? ["twilio"]
      : [];

export const getTransactionalEmailProvider = ():
  | TransactionalEmailProvider
  | null => getAvailableTransactionalEmailProviders()[0] ?? null;

export const getTransactionalFromEmail = () => getTwilioEmailFrom() ?? null;

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
    return { email: angle[2].trim(), name: name || "Nomi CRM" };
  }
  return { email: trimmed, name: "Nomi CRM" };
};

const formatEmailSendFailure = (message: string) => {
  const lower = message.toLowerCase();

  if (
    lower.includes("verified") ||
    lower.includes("sender") ||
    lower.includes("domain") ||
    lower.includes("authenticate")
  ) {
    return (
      "Twilio Email sender is not verified. In Twilio Console → Email, authenticate your domain " +
      "(e.g. lbs.bz) and set TWILIO_EMAIL_FROM on Supabase to a verified address."
    );
  }

  return message;
};

async function sendViaTwilioEmail(params: {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
}) {
  const accountSid = getTwilioAccountSid();
  const authToken = getTwilioAuthToken();
  const fromRaw = getTwilioEmailFrom();
  if (!accountSid || !authToken || !fromRaw) {
    throw new Error(
      "Twilio Email is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_EMAIL_FROM).",
    );
  }

  const from = parseEmailAddress(fromRaw);
  const body: Record<string, unknown> = {
    from: {
      address: from.email,
      name: from.name,
    },
    to: [{ address: params.to }],
    content: {
      subject: params.subject,
      text: params.textBody,
      html: params.htmlBody,
    },
  };

  if (params.replyTo?.trim()) {
    const replyTo = parseEmailAddress(params.replyTo);
    body.replyTo = {
      address: replyTo.email,
      ...(replyTo.name ? { name: replyTo.name } : {}),
    };
  }

  if (params.attachments?.length) {
    body.attachments = params.attachments.map((file) => ({
      filename: file.name,
      contentType: file.contentType,
      content: file.contentBase64,
    }));
  }

  const credentials = btoa(`${accountSid}:${authToken}`);
  const res = await fetch("https://comms.twilio.com/v1/Emails", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      formatEmailSendFailure(
        `Could not send email via Twilio Email (${res.status}) ${text}`,
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
      "Email is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_EMAIL_FROM on Supabase.",
    );
  }

  const htmlBody = textToHtml(params.textBody);
  const result = await sendViaTwilioEmail({ ...params, htmlBody });
  return { skipped: false as const, ...result };
}
