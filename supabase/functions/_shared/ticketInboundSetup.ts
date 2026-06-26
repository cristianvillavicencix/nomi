import { supabaseAdmin } from "./supabaseAdmin.ts";

export const getInboundWebhookCredentials = () => {
  const user =
    Deno.env.get("EMAIL_INBOUND_WEBHOOK_USER")?.trim() ??
    Deno.env.get("POSTMARK_WEBHOOK_USER")?.trim();
  const password =
    Deno.env.get("EMAIL_INBOUND_WEBHOOK_PASSWORD")?.trim() ??
    Deno.env.get("POSTMARK_WEBHOOK_PASSWORD")?.trim();
  return { user, password };
};

export const buildTicketInboundWebhookUrl = () => {
  const base = Deno.env.get("SUPABASE_URL")?.trim();
  const { user, password } = getInboundWebhookCredentials();
  if (!base || !user || !password) return null;

  const url = new URL(`${base}/functions/v1/email_inbound`);
  url.username = user;
  url.password = password;
  return url.toString();
};

export type TicketInboundSetup = {
  support_email: string;
  sendgrid_hostname: string | null;
  sendgrid_forward_address: string | null;
  hostinger_forward_to: string | null;
  mx_record: string;
  webhook_url: string | null;
  webhook_configured: boolean;
};

export async function getTicketInboundSetup(
  orgId: number,
): Promise<TicketInboundSetup | null> {
  const { data: inbox, error } = await supabaseAdmin
    .from("ticket_inboxes")
    .select("email, sendgrid_hostname, sendgrid_forward_address, is_active")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!inbox?.email) return null;

  const forwardAddress =
    inbox.sendgrid_forward_address?.trim() ||
    (inbox.sendgrid_hostname
      ? `inbox@${inbox.sendgrid_hostname.trim()}`
      : null);

  const webhookUrl = buildTicketInboundWebhookUrl();
  const { user, password } = getInboundWebhookCredentials();

  return {
    support_email: inbox.email,
    sendgrid_hostname: inbox.sendgrid_hostname?.trim() ?? null,
    sendgrid_forward_address: forwardAddress,
    hostinger_forward_to: forwardAddress,
    mx_record: "mx.sendgrid.net",
    webhook_url: webhookUrl,
    webhook_configured: Boolean(webhookUrl && user && password),
  };
}
