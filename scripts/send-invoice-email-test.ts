/**
 * Sends a sample client invoice email (HTML + PDF) to a test address.
 * Run: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/send-invoice-email-test.ts latinosupp@gmail.com
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildClientInvoicePdfContext,
  generateClientInvoicePdfBlob,
} from "../src/modules/billing/clientInvoicePdf";
import {
  buildDefaultInvoiceEmailSubject,
  buildInvoiceEmailHtml,
  buildInvoiceEmailPlainText,
  buildOrganizationEmailTagline,
  resolveInvoiceOrganizationName,
} from "../src/modules/billing/invoiceEmailTemplate";
import { getInvoiceOrganizationBranding } from "../src/modules/billing/invoiceOrganizationInfo";

const DEFAULT_PUBLIC_APP_URL = "https://www.nomicrm.com";
import type {
  ClientInvoice,
  ClientInvoiceLineItem,
} from "../src/modules/types";
import type { Company, Contact } from "../src/components/atomic-crm/types";

const SUPABASE_URL = "https://qjglkywmqwqdoaboakao.supabase.co";
const ADMIN_EMAIL = "admin@lbs.bz";
const INVOICE_ID = 4;

const toEmail = process.argv[2]?.trim().toLowerCase();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
  console.error(
    "Usage: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/send-invoice-email-test.ts <email>",
  );
  process.exit(1);
}

if (!serviceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getAdminAccessToken() {
  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: ADMIN_EMAIL,
    });
  if (linkError) throw linkError;

  const otp = linkData.properties?.email_otp;
  if (!otp) throw new Error("Could not generate admin OTP");

  const { data: verifyData, error: verifyError } =
    await supabase.auth.verifyOtp({
      email: ADMIN_EMAIL,
      token: otp,
      type: "magiclink",
    });
  if (verifyError) throw verifyError;
  if (!verifyData.session?.access_token) {
    throw new Error("Could not create admin session");
  }
  return verifyData.session.access_token;
}

async function main() {
  const { data: invoice, error: invoiceError } = await supabase
    .from("client_invoices")
    .select("*")
    .eq("id", INVOICE_ID)
    .single();

  if (invoiceError || !invoice) {
    throw invoiceError ?? new Error(`Invoice ${INVOICE_ID} not found`);
  }

  const { data: lineItems, error: lineError } = await supabase
    .from("client_invoice_line_items")
    .select("*")
    .eq("invoice_id", INVOICE_ID)
    .order("sort_order", { ascending: true });

  if (lineError) throw lineError;

  let company: Company | null = null;
  let contact: Contact | null = null;

  if (invoice.company_id) {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .eq("id", invoice.company_id)
      .maybeSingle();
    company = (data as Company | null) ?? null;
  }

  if (invoice.contact_id) {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", invoice.contact_id)
      .maybeSingle();
    contact = (data as Contact | null) ?? null;
  }

  const { data: tokenRow } = await supabase
    .from("public_client_invoice_tokens")
    .select("short_code, token")
    .eq("invoice_id", INVOICE_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const appBase =
    process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    DEFAULT_PUBLIC_APP_URL;
  const paymentUrl = tokenRow?.short_code
    ? `${appBase}/iv/${tokenRow.short_code}`
    : tokenRow?.token
      ? `${appBase}/portal/invoice/${tokenRow.token}`
      : appBase;

  const organizationName = resolveInvoiceOrganizationName({
    title: "Latino Business Support",
    companyLegalName: null,
  });
  const branding = getInvoiceOrganizationBranding();
  const organizationTagline = buildOrganizationEmailTagline();

  const emailContext = {
    invoice: invoice as ClientInvoice,
    lineItems: (lineItems ?? []) as ClientInvoiceLineItem[],
    organizationName,
    paymentUrl,
    contact,
    organizationTagline,
  };

  const pdfContext = buildClientInvoicePdfContext({
    invoice: invoice as ClientInvoice,
    organizationName,
    organizationAddress: branding.address,
    organizationWebsite: branding.website,
    company,
    contact,
    lineItems: (lineItems ?? []) as ClientInvoiceLineItem[],
    billToEmail: toEmail,
  });

  const pdfBlob = await generateClientInvoicePdfBlob(pdfContext);
  const pdfBase64 = Buffer.from(await pdfBlob.arrayBuffer()).toString("base64");

  const accessToken = await getAdminAccessToken();
  const subject = `[TEST] ${buildDefaultInvoiceEmailSubject(invoice as ClientInvoice, organizationName)}`;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/send_client_invoice`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoice_id: INVOICE_ID,
      to: toEmail,
      subject,
      message: buildInvoiceEmailPlainText(emailContext),
      html_message: buildInvoiceEmailHtml(emailContext),
      pdf_base64: pdfBase64,
      filename: `${invoice.invoice_number}.pdf`,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.message === "string" ? body.message : `HTTP ${res.status}`,
    );
  }

  console.warn(JSON.stringify(body, null, 2));
  if (body.email_skipped) {
    console.warn("Email was skipped — Twilio is not configured for this org.");
  } else if (body.email_sent) {
    console.warn(`Sent invoice email to ${toEmail}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
