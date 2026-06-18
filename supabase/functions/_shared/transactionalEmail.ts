import { supabaseAdmin } from "./supabaseAdmin.ts";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";

export type EmailAttachment = {
  name: string;
  contentBase64: string;
  contentType: string;
};

const getTwilioEmailFromOverride = () =>
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

const DEFAULT_ORGANIZATION_NAME = "Latino Business Support";

const parseEmailAddress = (value: string) => {
  const trimmed = value.trim();
  const angle = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    const name = angle[1].replace(/^["']|["']$/g, "").trim();
    return { email: angle[2].trim(), name: name || DEFAULT_ORGANIZATION_NAME };
  }
  return { email: trimmed, name: DEFAULT_ORGANIZATION_NAME };
};

const escapeHtml = (value: string) =>
  value.replace(/</g, "&lt;").replace(/>/g, "&gt;");

const linkifyLine = (line: string) =>
  escapeHtml(line).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#2563eb;text-decoration:underline;">$1</a>',
  );

const textToHtml = (textBody: string) =>
  textBody
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "<p>&nbsp;</p>";
      if (line.trim().startsWith("Pay here:")) {
        const url = line.replace(/^Pay here:\s*/i, "").trim();
        if (/^https?:\/\//i.test(url)) {
          return `<p style="margin:20px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Pay here</a></p>`;
        }
      }
      return `<p>${linkifyLine(line)}</p>`;
    })
    .join("");

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
      "(e.g. lbs.bz). Set TWILIO_EMAIL_FROM on Supabase or your organization reply-to in Settings."
    );
  }

  if (lower.includes("twilio is not configured")) {
    return (
      "Twilio is not configured for email. Add your Account SID and Auth Token under Settings → Communications (same as SMS)."
    );
  }

  return message;
};

const resolveOrgTwilioCredentials = async (orgId: number) => {
  const settings = await getMessagingSettingsSecrets(orgId);
  const accountSid = settings?.twilio_account_sid?.trim();
  const authToken = settings?.twilio_auth_token?.trim();
  if (!accountSid || !authToken) return null;
  return { accountSid, authToken };
};

const resolveFromAddress = async (
  orgId: number,
  orgName?: string | null,
) => {
  const override = getTwilioEmailFromOverride();
  if (override) return parseEmailAddress(override);

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("name, email")
    .eq("id", orgId)
    .maybeSingle();

  const name = orgName?.trim() || org?.name?.trim() || DEFAULT_ORGANIZATION_NAME;
  const address = org?.email?.trim() || "billing@lbs.bz";
  return { email: address, name };
};

export async function isOrgTransactionalEmailConfigured(orgId: number) {
  try {
    return Boolean(await resolveOrgTwilioCredentials(orgId));
  } catch (error) {
    console.error("transactional_email.config_check_failed", orgId, error);
    return false;
  }
}

export async function getOrgTransactionalEmailStatus(orgId: number) {
  const configured = await isOrgTransactionalEmailConfigured(orgId);
  const fromOverride = getTwilioEmailFromOverride();
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("name, email")
    .eq("id", orgId)
    .maybeSingle();

  const fromPreview = fromOverride
    ? fromOverride
    : org?.email?.trim()
      ? `${org?.name ?? DEFAULT_ORGANIZATION_NAME} <${org.email.trim()}>`
      : `${org?.name ?? DEFAULT_ORGANIZATION_NAME} <billing@lbs.bz>`;

  return {
    configured,
    provider: configured ? ("twilio" as const) : null,
    from_email: configured ? fromPreview : null,
    uses_messaging_credentials: configured,
  };
}

export const getTransactionalEmailProvider = (): TransactionalEmailProvider | null =>
  "twilio";

export async function getTransactionalFromEmail(orgId: number) {
  const status = await getOrgTransactionalEmailStatus(orgId);
  return status.from_email;
}

export async function isTransactionalEmailConfigured(orgId: number) {
  return isOrgTransactionalEmailConfigured(orgId);
}

async function sendViaTwilioEmail(params: {
  accountSid: string;
  authToken: string;
  from: { email: string; name: string };
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  textBody: string;
  htmlBody: string;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
}) {
  const content: Record<string, unknown> = {
    subject: params.subject,
    text: params.textBody,
    html: params.htmlBody,
  };

  if (params.attachments?.length) {
    content.attachments = params.attachments.map((file) => ({
      filename: file.name,
      contentType: file.contentType,
      content: file.contentBase64,
    }));
  }

  const body: Record<string, unknown> = {
    from: {
      address: params.from.email,
      name: params.from.name,
    },
    to: params.to.map((address) => ({ address })),
    content,
  };

  if (params.cc?.length) {
    body.cc = params.cc.map((address) => ({ address }));
  }
  if (params.bcc?.length) {
    body.bcc = params.bcc.map((address) => ({ address }));
  }

  // Twilio Email API (comms.twilio.com/v1/Emails) rejects replyTo — contact info stays in the body.

  const credentials = btoa(`${params.accountSid}:${params.authToken}`);
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
  orgId: number;
  orgName?: string | null;
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  textBody: string;
  htmlBody?: string | null;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
  fromEmail?: string | null;
  fromName?: string | null;
}) {
  if (isTransactionalEmailSkipped()) {
    console.warn(
      "transactional_email.skip",
      "Email delivery skipped (SKIP_TRANSACTIONAL_EMAIL)",
    );
    return { skipped: true as const, provider: null };
  }

  const twilio = await resolveOrgTwilioCredentials(params.orgId);
  if (!twilio) {
    throw new Error(
      "Twilio is not configured. Add Account SID and Auth Token under Settings → Communications.",
    );
  }

  const from = params.fromEmail?.trim()
    ? {
        email: params.fromEmail.trim(),
        name: params.fromName?.trim() || DEFAULT_ORGANIZATION_NAME,
      }
    : await resolveFromAddress(params.orgId, params.orgName);
  const htmlBody = params.htmlBody?.trim() || textToHtml(params.textBody);
  const toAddresses = (Array.isArray(params.to) ? params.to : [params.to])
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
  if (!toAddresses.length) {
    throw new Error("At least one recipient email is required");
  }
  const result = await sendViaTwilioEmail({
    accountSid: twilio.accountSid,
    authToken: twilio.authToken,
    from,
    to: toAddresses,
    cc: params.cc,
    bcc: params.bcc,
    subject: params.subject,
    textBody: params.textBody,
    htmlBody,
    replyTo: params.replyTo,
    attachments: params.attachments,
  });

  return { skipped: false as const, ...result };
}
