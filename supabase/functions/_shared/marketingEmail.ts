import { supabaseAdmin } from "./supabaseAdmin.ts";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";

const getTwilioEmailFromOverride = () =>
  Deno.env.get("TWILIO_EMAIL_FROM")?.trim() ??
  Deno.env.get("TWILIO_SENDGRID_FROM_EMAIL")?.trim();

const parseEmailAddress = (value: string, orgName: string) => {
  const trimmed = value.trim();
  const angle = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    const name = angle[1].replace(/^["']|["']$/g, "").trim();
    return { email: angle[2].trim(), name: name || orgName };
  }
  return { email: trimmed, name: orgName };
};

const getUnsubscribeUrl = (token: string) => {
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/functions/v1/marketing_unsubscribe?token=${encodeURIComponent(token)}`;
};

export async function resolveMarketingFromAddress(orgId: number) {
  const override = getTwilioEmailFromOverride();
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("name, email")
    .eq("id", orgId)
    .maybeSingle();

  const orgName = org?.name?.trim() || "Latino Business Support";

  const { data: settings } = await supabaseAdmin
    .from("organization_messaging_settings")
    .select("marketing_email_from")
    .eq("org_id", orgId)
    .maybeSingle();

  const marketingFrom = settings?.marketing_email_from?.trim();
  if (marketingFrom) {
    return parseEmailAddress(marketingFrom, orgName);
  }

  if (override) {
    return parseEmailAddress(override, orgName);
  }

  const address = org?.email?.trim() || "billing@lbs.bz";
  return { email: address, name: orgName };
}

export async function sendMarketingEmail(params: {
  orgId: number;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  unsubscribeToken: string;
}) {
  const secrets = await getMessagingSettingsSecrets(params.orgId);
  const accountSid = secrets?.twilio_account_sid?.trim();
  const authToken = secrets?.twilio_auth_token?.trim();
  if (!accountSid || !authToken) {
    throw new Error("Twilio email credentials are not configured");
  }

  const from = await resolveMarketingFromAddress(params.orgId);
  const unsubscribeUrl = getUnsubscribeUrl(params.unsubscribeToken);
  const footerHtml = unsubscribeUrl
    ? `<p style="margin-top:24px;font-size:12px;color:#6b7280;"><a href="${unsubscribeUrl}">Unsubscribe</a> from marketing emails.</p>`
    : "";
  const footerText = unsubscribeUrl
    ? `\n\nUnsubscribe: ${unsubscribeUrl}`
    : "";

  const html = `${params.bodyHtml}${footerHtml}`;
  const text = `${params.bodyText?.trim() || params.bodyHtml.replace(/<[^>]+>/g, " ")}${footerText}`;

  const response = await fetch(
    `https://email.twilio.com/v3/mail/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.to }] }],
        from,
        subject: params.subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
      }),
    },
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof json?.errors?.[0]?.message === "string"
        ? json.errors[0].message
        : typeof json?.message === "string"
          ? json.message
          : "Twilio rejected the marketing email";
    throw new Error(message);
  }

  return json as { id?: string };
}
