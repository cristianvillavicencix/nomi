import {
  INVOICE_ORGANIZATION_EMAIL,
  INVOICE_ORGANIZATION_NAME,
} from "./invoiceOrganizationInfo.ts";
import { supabaseAdmin } from "./supabaseAdmin.ts";

export const DEFAULT_BILLING_FROM_EMAIL = "billing@lbs.bz";

export type ResolvedEmailSender = {
  email: string;
  name: string;
};

const parseEmailAddress = (value: string): ResolvedEmailSender => {
  const trimmed = value.trim();
  const angle = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    const name = angle[1].replace(/^["']|["']$/g, "").trim();
    return {
      email: angle[2].trim(),
      name: name || INVOICE_ORGANIZATION_NAME,
    };
  }
  return { email: trimmed, name: INVOICE_ORGANIZATION_NAME };
};

const getTwilioBillingFromOverride = (): ResolvedEmailSender | null => {
  const raw =
    Deno.env.get("TWILIO_EMAIL_FROM")?.trim() ??
    Deno.env.get("TWILIO_SENDGRID_FROM_EMAIL")?.trim();
  if (!raw) return null;
  return parseEmailAddress(raw);
};

const getGeneralFromEnvOverride = (): ResolvedEmailSender | null => {
  const raw =
    Deno.env.get("LBS_GENERAL_FROM_EMAIL")?.trim() ??
    Deno.env.get("ORG_GENERAL_FROM_EMAIL")?.trim();
  if (!raw) return null;
  return parseEmailAddress(raw);
};

type OrgSenderRow = {
  name: string | null;
  email: string | null;
  billing_from_email: string | null;
};

const loadOrgSenderRow = async (orgId: number): Promise<OrgSenderRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("name, email, billing_from_email")
    .eq("id", orgId)
    .maybeSingle();

  if (
    error?.message?.includes("billing_from_email") ||
    error?.message?.includes("column")
  ) {
    const { data: fallback, error: fallbackError } = await supabaseAdmin
      .from("organizations")
      .select("name, email")
      .eq("id", orgId)
      .maybeSingle();
    if (fallbackError) {
      console.error("organization_email_senders.load_failed", orgId, fallbackError);
      return null;
    }
    return fallback ? { ...fallback, billing_from_email: null } : null;
  }

  if (error) {
    console.error("organization_email_senders.load_failed", orgId, error);
    return null;
  }
  return data;
};

const resolveOrgName = (
  orgName: string | null | undefined,
  orgRow: OrgSenderRow | null,
) =>
  orgName?.trim() ||
  orgRow?.name?.trim() ||
  INVOICE_ORGANIZATION_NAME;

/** Invoices, payment links, receipts, reminders. */
export async function resolveOrgBillingFrom(
  orgId: number,
  orgName?: string | null,
): Promise<ResolvedEmailSender> {
  const orgRow = await loadOrgSenderRow(orgId);
  const name = resolveOrgName(orgName, orgRow);

  const fromOrg = orgRow?.billing_from_email?.trim();
  if (fromOrg) {
    return { email: fromOrg, name };
  }

  const envOverride = getTwilioBillingFromOverride();
  if (envOverride) {
    return { ...envOverride, name: envOverride.name || name };
  }

  return { email: DEFAULT_BILLING_FROM_EMAIL, name };
};

/** Portal codes, meetings, and other client-facing system mail. */
export async function resolveOrgGeneralFrom(
  orgId: number,
  orgName?: string | null,
): Promise<ResolvedEmailSender> {
  const orgRow = await loadOrgSenderRow(orgId);
  const name = resolveOrgName(orgName, orgRow);

  const envOverride = getGeneralFromEnvOverride();
  if (envOverride) {
    return { ...envOverride, name: envOverride.name || name };
  }

  const fromOrg = orgRow?.email?.trim();
  if (fromOrg) {
    return { email: fromOrg, name };
  }

  return { email: INVOICE_ORGANIZATION_EMAIL, name };
};

export const formatSenderPreview = (sender: ResolvedEmailSender) =>
  `${sender.name} <${sender.email}>`;

export async function getOrgEmailSenderPreviews(orgId: number) {
  const [billing, general] = await Promise.all([
    resolveOrgBillingFrom(orgId),
    resolveOrgGeneralFrom(orgId),
  ]);
  return {
    billing_from_email: billing.email,
    general_from_email: general.email,
    billing_from_preview: formatSenderPreview(billing),
    general_from_preview: formatSenderPreview(general),
  };
};

/** From billing@, reply-to general@ — for invoices and payment mail. */
export async function getOrgInvoiceEmailSendOptions(
  orgId: number,
  orgName?: string | null,
) {
  const [billing, general] = await Promise.all([
    resolveOrgBillingFrom(orgId, orgName),
    resolveOrgGeneralFrom(orgId, orgName),
  ]);
  return {
    fromEmail: billing.email,
    fromName: billing.name,
    replyTo: general.email,
  };
};
