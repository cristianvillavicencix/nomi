import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { generateSecureToken } from "./formV2Schema.ts";
import { generateUniqueShortCode } from "./formTokenUtils.ts";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "./transactionalEmail.ts";
import { resolveContactEmail } from "./clientProposalBilling.ts";
import { INVOICE_ORGANIZATION_NAME } from "./invoiceOrganizationInfo.ts";
import { resolvePublicAppBaseUrl } from "./publicAppUrl.ts";
import { createStandaloneClientInvoice } from "./clientInvoiceFlow.ts";
import {
  calculateSupplementPricing,
  type SupplementPricingInput,
} from "./supplementPricing.ts";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const ensureShareLink = async (
  supabase: SupabaseClient,
  invoiceId: number,
  orgId: number,
  baseUrl: string,
) => {
  const { data: existing } = await supabase
    .from("public_client_invoice_tokens")
    .select("token, short_code, expires_at")
    .eq("invoice_id", invoiceId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.token) {
    const expired =
      existing.expires_at &&
      new Date(existing.expires_at).getTime() < Date.now();
    if (!expired) {
      const url = existing.short_code
        ? `${baseUrl}/iv/${existing.short_code}?pay=1`
        : `${baseUrl}/portal/invoice/${existing.token}?pay=1`;
      return { token: existing.token, url };
    }
  }

  const token = generateSecureToken();
  const shortCode = await generateUniqueShortCode(async (code) => {
    const { data: hit } = await supabase
      .from("public_client_invoice_tokens")
      .select("id")
      .eq("short_code", code)
      .maybeSingle();
    return Boolean(hit?.id);
  });
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("public_client_invoice_tokens").insert({
    org_id: orgId,
    invoice_id: invoiceId,
    token,
    short_code: shortCode,
    expires_at: expiresAt,
  });
  if (error) {
    throw new Error(error.message);
  }

  return {
    token,
    url: `${baseUrl}/iv/${shortCode}?pay=1`,
  };
};

export async function createTicketInvoiceAndSendPaymentLink(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    memberId: number;
    ticketId: number;
    baseUrl?: string;
    pricingOverride?: Partial<SupplementPricingInput>;
  },
) {
  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, org_id, subject, status, company_id, contact_id, deal_id, requester_email, invoice_id, merged_into_ticket_id, billing_item_count, billing_has_roof, billing_has_siding, billing_has_esx, billing_has_pdf_analysis, delivery_status",
    )
    .eq("id", params.ticketId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!ticket?.id) {
    throw new Error("Ticket not found");
  }
  if (ticket.merged_into_ticket_id) {
    throw new Error("Cannot invoice a merged ticket");
  }
  if (ticket.invoice_id) {
    throw new Error("This ticket already has an invoice");
  }

  const { count: deliverableCount } = await supabase
    .from("ticket_deliverables")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticket.id)
    .eq("org_id", params.orgId);

  if (!deliverableCount) {
    throw new Error("Upload at least one delivery file before sending an invoice");
  }

  if (!ticket.company_id && !ticket.contact_id) {
    throw new Error("Link a company or contact before sending an invoice");
  }

  const contactEmail = ticket.contact_id
    ? await resolveContactEmail(supabase, ticket.contact_id)
    : null;
  const recipientEmail =
    ticket.requester_email?.trim().toLowerCase() ||
    contactEmail?.trim().toLowerCase() ||
    "";

  if (!recipientEmail || !emailRegex.test(recipientEmail)) {
    throw new Error("Add a valid recipient email before sending an invoice");
  }

  if (!(await isOrgTransactionalEmailConfigured(params.orgId))) {
    throw new Error("Email is not configured for your organization");
  }

  const pricing = calculateSupplementPricing({
    itemCount:
      params.pricingOverride?.itemCount ?? ticket.billing_item_count ?? 0,
    hasRoof:
      params.pricingOverride?.hasRoof ?? Boolean(ticket.billing_has_roof),
    hasSiding:
      params.pricingOverride?.hasSiding ?? Boolean(ticket.billing_has_siding),
    hasEsx: params.pricingOverride?.hasEsx ?? Boolean(ticket.billing_has_esx),
    hasPdfAnalysis:
      params.pricingOverride?.hasPdfAnalysis ??
      Boolean(ticket.billing_has_pdf_analysis),
  });

  const today = new Date().toISOString().slice(0, 10);
  const dueDate = addDays(today, 7);
  const lineItems = [
    ...pricing.lines.map((line, index) => ({
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unitPrice,
      sort_order: index,
    })),
  ];

  if (pricing.transferFee > 0) {
    lineItems.push({
      description: "Transfer fee",
      quantity: 1,
      unit: "ea",
      unit_price: pricing.transferFee,
      sort_order: lineItems.length,
    });
  }

  const invoice = await createStandaloneClientInvoice(supabase, params.orgId, {
    company_id: ticket.company_id ?? null,
    contact_id: ticket.contact_id ?? null,
    deal_id: ticket.deal_id ?? null,
    ticket_id: ticket.id,
    issue_date: today,
    due_date: dueDate,
    terms: "Due on receipt",
    subtotal: pricing.subtotal,
    fee_amount: pricing.transferFee,
    amount: pricing.total,
    description: `Xactimate supplement · Ticket #${ticket.id}`,
    reference: `Ticket #${ticket.id} · ${ticket.subject}`,
    recipient_email: recipientEmail,
    save_card_for_future_charges: false,
    upfront_percent: 100,
    auto_charge_remainder: false,
    line_items: lineItems,
  });

  const now = new Date().toISOString();
  await supabase
    .from("tickets")
    .update({
      invoice_id: invoice.id,
      status: "waiting",
      delivery_status: "invoice_sent",
      updated_at: now,
    })
    .eq("id", ticket.id)
    .eq("org_id", params.orgId);

  await supabase.from("ticket_messages").insert({
    ticket_id: ticket.id,
    author_member_id: params.memberId,
    body: `Invoice ${invoice.invoice_number} sent for payment. Files will be delivered automatically after payment.`,
    direction: "internal",
    from_name: "System",
    created_at: now,
  });

  const baseUrl = (params.baseUrl?.trim() || resolvePublicAppBaseUrl()).replace(
    /\/$/,
    "",
  );
  const { url } = await ensureShareLink(
    supabase,
    Number(invoice.id),
    params.orgId,
    baseUrl,
  );

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", params.orgId)
    .maybeSingle();

  const orgName = org?.name?.trim() || INVOICE_ORGANIZATION_NAME;
  const balanceFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(pricing.total);

  const subject = `${orgName}: Pay invoice ${invoice.invoice_number}`;
  const textBody = [
    "Your Xactimate supplement is ready.",
    "Please pay using the secure link below. Your files will be delivered automatically by email after payment.",
    "",
    `Invoice: ${invoice.invoice_number}`,
    `Amount due: ${balanceFormatted}`,
    "",
    `Pay securely: ${url}`,
    "",
    orgName,
  ].join("\n");

  const htmlBody = `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
      <p>Your Xactimate supplement is ready.</p>
      <p>Please pay using the button below. <strong>Your files will be delivered automatically by email after payment.</strong></p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 0;color:#64748b;">Invoice</td><td style="padding:4px 0;text-align:right;font-weight:600;">${invoice.invoice_number}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Amount due</td><td style="padding:4px 0;text-align:right;font-weight:600;">${balanceFormatted}</td></tr>
      </table>
      <p style="margin:20px 0;"><a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Pay securely</a></p>
      <p style="color:#64748b;font-size:13px;">${orgName}</p>
    </div>`;

  await sendTransactionalEmail({
    orgId: params.orgId,
    orgName,
    to: recipientEmail,
    subject,
    textBody,
    htmlBody,
  });

  await supabase
    .from("client_invoices")
    .update({
      status: "sent",
      sent_at: now,
      updated_at: now,
    })
    .eq("id", invoice.id)
    .eq("org_id", params.orgId);

  return {
    invoice: { ...invoice, status: "sent", sent_at: now },
    payment_url: url,
    to: recipientEmail,
    pricing,
  };
}
