import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { generateSecureToken } from "./formV2Schema.ts";
import { generateUniqueShortCode } from "./formTokenUtils.ts";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "./transactionalEmail.ts";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import { sendTwilioSms } from "./twilio.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";
import {
  ensureClientConversation,
  insertSmsMessage,
  touchConversationFirstResponse,
} from "./messagingConversations.ts";
import { sanitizeMessageBody } from "./messagingUtils.ts";
import { resolveContactEmail } from "./clientProposalBilling.ts";
import { INVOICE_ORGANIZATION_NAME } from "./invoiceOrganizationInfo.ts";
import { resolvePublicAppBaseUrl } from "./publicAppUrl.ts";
import {
  createStandaloneClientInvoice,
  deleteStandaloneClientInvoice,
} from "./clientInvoiceFlow.ts";
import { DEFAULT_INVOICE_TERMS_AND_CONDITIONS } from "./invoiceDefaults.ts";
import {
  calculatePricingFromTicketLegacy,
  calculateTicketPricing,
  type SupplementPricingInput,
} from "./supplementPricing.ts";
import {
  buildTicketInvoiceSentInternalNoteBody,
  loadTicketInvoiceSentNoteContext,
} from "./ticketInvoiceInternalNoteSummary.ts";
import { getTransactionalFromEmail } from "./transactionalEmail.ts";
import {
  buildTicketPaymentSmsText,
  resolveTicketSmsServiceSubject,
} from "./ticketInvoiceCopy.ts";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE =
  "Your project deliverables are ready.\n\nPlease pay using the secure link below. Your files will be delivered automatically by email after payment.";

export const DEFAULT_TICKET_PAYMENT_REMINDER_MESSAGE =
  "This is a friendly reminder that your invoice is still unpaid.\n\nPlease pay using the secure link below to complete payment. Your files will be delivered automatically after payment.";

export const buildTicketPaymentEmailSubject = (propertyAddress: string) =>
  `Invoice for services (${propertyAddress.trim()})`;

export const buildTicketPaymentReminderSubject = (propertyAddress: string) =>
  `Reminder: Invoice for services (${propertyAddress.trim()})`;

export const buildTicketDeliveryEmailSubject = (propertyAddress: string) =>
  `Your project files are ready (${propertyAddress.trim()})`;

const formatTicketInternalNoteDate = (iso?: string | null) => {
  if (!iso?.trim()) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
      new Date(`${iso}T12:00:00`),
    );
  } catch {
    return iso;
  }
};

const formatTicketInternalSmsNote = (params: {
  smsTo?: string | null;
  smsSent?: boolean;
  smsSkipped?: boolean;
  attempted?: boolean;
}) => {
  const phone = params.smsTo?.trim();
  if (!phone) return "Not sent";
  if (params.smsSent) return `Sent to ${phone}`;
  if (params.smsSkipped) return `Not sent — SMS not configured (${phone})`;
  if (params.attempted) return `Failed — ${phone}`;
  return "Not sent";
};

export { buildTicketInvoiceSentInternalNoteBody } from "./ticketInvoiceInternalNoteSummary.ts";

export const buildTicketPaymentReminderInternalNoteBody = (params: {
  invoiceNumber: string;
  amountFormatted: string;
  dueDate?: string | null;
  recipientEmail: string;
  propertyAddress?: string | null;
  smsTo?: string | null;
  smsSent?: boolean;
  smsSkipped?: boolean;
}) => {
  const dueDate = formatTicketInternalNoteDate(params.dueDate);

  return [
    "**Payment reminder sent**",
    "",
    `- **Invoice:** ${params.invoiceNumber}`,
    `- **Amount due:** ${params.amountFormatted}`,
    ...(dueDate ? [`- **Due date:** ${dueDate}`] : []),
    ...(params.propertyAddress?.trim()
      ? [`- **Property:** ${params.propertyAddress.trim()}`]
      : []),
    `- **Email:** ${params.recipientEmail}`,
    `- **Text:** ${formatTicketInternalSmsNote({
      smsTo: params.smsTo,
      smsSent: params.smsSent,
      smsSkipped: params.smsSkipped,
      attempted: Boolean(params.smsTo?.trim()),
    })}`,
  ].join("\n");
};

export const buildTicketDeliveredInternalNoteBody = (params: {
  invoiceNumber: string;
  propertyAddress?: string | null;
  fileCount: number;
  recipientEmail: string;
}) => {
  const fileLabel = params.fileCount === 1 ? "1 file" : `${params.fileCount} files`;

  return [
    "**Supplement files delivered**",
    "",
    `- **Invoice:** ${params.invoiceNumber}`,
    ...(params.propertyAddress?.trim()
      ? [`- **Property:** ${params.propertyAddress.trim()}`]
      : []),
    `- **Delivered:** ${fileLabel} emailed to ${params.recipientEmail}`,
    "",
    "Ticket marked resolved.",
  ].join("\n");
};

const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildTicketPaymentEmailBodies = (params: {
  orgName: string;
  invoiceNumber: string;
  amountFormatted: string;
  paymentUrl: string;
  customMessage?: string;
  subject?: string;
  propertyAddress?: string;
  serviceLines?: string[];
}) => {
  const intro =
    params.customMessage?.trim() || DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE;
  const introHtml = intro
    .split(/\n\n+/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const serviceLines = (params.serviceLines ?? []).filter(Boolean);
  const servicesHtml =
    serviceLines.length > 1
      ? `<div style="margin:16px 0;"><p style="margin:0 0 8px;font-weight:600;">Services included</p><ul style="margin:0;padding-left:20px;">${serviceLines
          .map((line) => `<li style="margin:4px 0;">${escapeHtml(line)}</li>`)
          .join("")}</ul></div>`
      : "";

  const subject =
    params.subject?.trim() ||
    (params.propertyAddress
      ? buildTicketPaymentEmailSubject(params.propertyAddress)
      : `${params.orgName}: Pay invoice ${params.invoiceNumber}`);
  const textBody = [
    intro,
    "",
    `Invoice: ${params.invoiceNumber}`,
    `Amount due: ${params.amountFormatted}`,
    "",
    `Pay securely: ${params.paymentUrl}`,
    "",
    params.orgName,
  ].join("\n");

  const htmlBody = `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
      ${introHtml}
      ${servicesHtml}
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 0;color:#64748b;">Invoice</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(params.invoiceNumber)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Amount due</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(params.amountFormatted)}</td></tr>
      </table>
      <p style="margin:20px 0;"><a href="${escapeHtml(params.paymentUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Pay securely</a></p>
      <p style="color:#64748b;font-size:13px;">${escapeHtml(params.orgName)}</p>
    </div>`;

  return { subject, textBody, htmlBody };
};

export async function sendTicketInvoiceSms(
  supabase: SupabaseClient,
  params: {
  orgId: number;
  memberId: number;
  phoneRaw: string;
  body: string;
  contactId?: number | null;
}) {
  const normalizedPhone = normalizeUsPhoneToE164(params.phoneRaw);
  if (!normalizedPhone) {
    throw new Error("Enter a valid US mobile number for text delivery");
  }

  const settings = await getMessagingSettingsSecrets(params.orgId);
  if (!settings?.sms_enabled) {
    return { sent: false, skipped: true, reason: "sms_disabled" as const };
  }

  const accountSid = settings.twilio_account_sid?.trim();
  const authToken = settings.twilio_auth_token?.trim();
  const fromNumber = settings.twilio_phone_number?.trim();
  if (!accountSid || !authToken || !fromNumber) {
    return { sent: false, skipped: true, reason: "sms_not_configured" as const };
  }

  const body = sanitizeMessageBody(params.body.trim());
  if (!body) {
    throw new Error("Text message body is empty");
  }

  const twilioResponse = await sendTwilioSms({
    accountSid,
    authToken,
    from: fromNumber,
    to: normalizedPhone,
    body,
  });

  if (params.contactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("id", params.contactId)
      .eq("org_id", params.orgId)
      .maybeSingle();

    if (contact?.id) {
      const conversation = await ensureClientConversation({
        orgId: params.orgId,
        externalPhone: normalizedPhone,
        contactId: contact.id,
        dealId: null,
        createdByMemberId: params.memberId,
        title:
          `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
          normalizedPhone,
      });

      const message = await insertSmsMessage({
        conversationId: Number(conversation.id),
        body,
        direction: "outbound",
        authorMemberId: params.memberId,
        externalId: twilioResponse.sid ?? null,
        mediaUrl: null,
        isInternalNote: false,
        replyToMessageId: null,
      });

      await touchConversationFirstResponse(
        Number(conversation.id),
        message.created_at ?? new Date().toISOString(),
      );
    }
  }

  return { sent: true, skipped: false, reason: null };
};

export const ensureShareLink = async (
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

async function loadTicketForInvoice(
  supabase: SupabaseClient,
  orgId: number,
  ticketId: number,
) {
  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, org_id, subject, status, company_id, contact_id, deal_id, requester_email, invoice_id, merged_into_ticket_id, billing_item_count, billing_has_roof, billing_has_siding, billing_has_esx, billing_has_pdf_analysis, delivery_status",
    )
    .eq("id", ticketId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!ticket?.id) {
    throw new Error("Ticket not found");
  }
  if (ticket.merged_into_ticket_id) {
    throw new Error("Cannot invoice a merged ticket");
  }

  if (ticket.invoice_id) {
    const { count: combinedCount } = await supabase
      .from("client_invoice_tickets")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", ticket.invoice_id)
      .eq("org_id", orgId);

    if ((combinedCount ?? 0) > 1) {
      throw new Error(
        "This ticket is on a combined invoice. Manage it from the bulk Create invoice action.",
      );
    }
  }

  const { count: deliverableCount } = await supabase
    .from("ticket_deliverables")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticket.id)
    .eq("org_id", orgId)
    .is("invoiced_invoice_id", null);

  if (!deliverableCount) {
    throw new Error(
      "Upload at least one new delivery file before sending an invoice",
    );
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

  return { ticket, recipientEmail, deliverableCount: deliverableCount ?? 0 };
}

async function loadTicketCatalogPackages(
  supabase: SupabaseClient,
  orgId: number,
) {
  const { data = [] } = await supabase
    .from("service_packages")
    .select(
      "id, name, description, suggested_price, ticket_billing_slug, ticket_pricing_mode, active, sort_order",
    )
    .eq("org_id", orgId)
    .eq("ticket_billing_enabled", true)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  return data;
}

async function loadTicketDeliverablesForBilling(
  supabase: SupabaseClient,
  orgId: number,
  ticketId: number,
  options?: { onlyUninvoiced?: boolean },
) {
  let query = supabase
    .from("ticket_deliverables")
    .select("billing_kind, billing_line_count, service_package_id, title")
    .eq("ticket_id", ticketId)
    .eq("org_id", orgId);

  if (options?.onlyUninvoiced !== false) {
    query = query.is("invoiced_invoice_id", null);
  }

  const { data } = await query.order("sort_order", { ascending: true });

  return data ?? [];
}

async function buildPricingForTicket(
  supabase: SupabaseClient,
  orgId: number,
  ticket: {
    id: number;
    subject: string;
    billing_item_count?: number | null;
    billing_has_roof?: boolean | null;
    billing_has_siding?: boolean | null;
    billing_has_esx?: boolean | null;
    billing_has_pdf_analysis?: boolean | null;
  },
  pricingOverride?: Partial<SupplementPricingInput>,
) {
  const deliverables = await loadTicketDeliverablesForBilling(
    supabase,
    orgId,
    ticket.id,
  );
  const catalogPackages = await loadTicketCatalogPackages(supabase, orgId);

  if (pricingOverride) {
    return calculatePricingFromTicketLegacy(
      {
        itemCount:
          pricingOverride.itemCount ?? ticket.billing_item_count ?? 0,
        hasRoof:
          pricingOverride.hasRoof ?? Boolean(ticket.billing_has_roof),
        hasSiding:
          pricingOverride.hasSiding ?? Boolean(ticket.billing_has_siding),
        hasEsx: pricingOverride.hasEsx ?? Boolean(ticket.billing_has_esx),
        hasPdfAnalysis:
          pricingOverride.hasPdfAnalysis ??
          Boolean(ticket.billing_has_pdf_analysis),
      },
      ticket.subject,
    );
  }

  return calculateTicketPricing(
    deliverables,
    ticket,
    ticket.subject,
    catalogPackages,
  );
}

async function syncDraftInvoiceFromDeliverables(
  supabase: SupabaseClient,
  orgId: number,
  invoiceId: number,
  ticket: {
    id: number;
    subject: string;
    billing_item_count?: number | null;
    billing_has_roof?: boolean | null;
    billing_has_siding?: boolean | null;
    billing_has_esx?: boolean | null;
    billing_has_pdf_analysis?: boolean | null;
  },
) {
  const pricing = await buildPricingForTicket(supabase, orgId, ticket);
  if (!pricing.lines.length) {
    throw new Error("Configure billing on each delivery file before sending");
  }

  await removeTicketInvoiceTransferFeeLines(supabase, invoiceId, orgId);

  await supabase
    .from("client_invoice_line_items")
    .delete()
    .eq("invoice_id", invoiceId)
    .eq("org_id", orgId);

  const lineRows = pricing.lines.map((line, index) => {
    const quantity = Number(line.quantity) || 1;
    const unitPrice = Number(line.unitPrice) || 0;
    return {
      org_id: orgId,
      invoice_id: invoiceId,
      description: line.description,
      quantity,
      unit: line.unit ?? "ea",
      unit_price: unitPrice,
      line_total: Math.round(quantity * unitPrice * 100) / 100,
      sort_order: index,
    };
  });

  const { error: linesError } = await supabase
    .from("client_invoice_line_items")
    .insert(lineRows);

  if (linesError) {
    throw new Error(linesError.message ?? "Could not update invoice lines");
  }

  const now = new Date().toISOString();
  const { error: invoiceError } = await supabase
    .from("client_invoices")
    .update({
      subtotal: pricing.subtotal,
      fee_amount: pricing.transferFee,
      amount: pricing.total,
      updated_at: now,
    })
    .eq("id", invoiceId)
    .eq("org_id", orgId);

  if (invoiceError) {
    throw new Error(invoiceError.message ?? "Could not update invoice totals");
  }

  return pricing;
}

async function ensureTicketInvoiceTermsAndConditions(
  supabase: SupabaseClient,
  invoiceId: number,
  orgId: number,
  existingNotes?: string | null,
) {
  if (existingNotes?.trim()) return existingNotes.trim();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("client_invoices")
    .update({
      notes: DEFAULT_INVOICE_TERMS_AND_CONDITIONS,
      updated_at: now,
    })
    .eq("id", invoiceId)
    .eq("org_id", orgId);

  if (error) {
    throw new Error(error.message ?? "Could not update invoice terms");
  }

  return DEFAULT_INVOICE_TERMS_AND_CONDITIONS;
}

async function createDraftInvoiceForTicket(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    ticket: {
      id: number;
      subject: string;
      company_id?: number | null;
      contact_id?: number | null;
      deal_id?: number | null;
      billing_item_count?: number | null;
      billing_has_roof?: boolean | null;
      billing_has_siding?: boolean | null;
      billing_has_esx?: boolean | null;
      billing_has_pdf_analysis?: boolean | null;
    };
    recipientEmail: string;
    pricingOverride?: Partial<SupplementPricingInput>;
  },
) {
  const pricing = await buildPricingForTicket(
    supabase,
    params.orgId,
    params.ticket,
    params.pricingOverride,
  );
  const today = new Date().toISOString().slice(0, 10);
  const dueDate = addDays(today, 7);
  const lineItems = pricing.lines.map((line, index) => ({
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unitPrice,
    sort_order: index,
  }));

  const invoice = await createStandaloneClientInvoice(supabase, params.orgId, {
    company_id: params.ticket.company_id ?? null,
    contact_id: params.ticket.contact_id ?? null,
    deal_id: params.ticket.deal_id ?? null,
    ticket_id: params.ticket.id,
    issue_date: today,
    due_date: dueDate,
    terms: "Due on receipt",
    notes: DEFAULT_INVOICE_TERMS_AND_CONDITIONS,
    subtotal: pricing.subtotal,
    fee_amount: pricing.transferFee,
    amount: pricing.total,
    description: `Xactimate supplement · Ticket #${params.ticket.id}`,
    reference: `Ticket #${params.ticket.id} · ${params.ticket.subject}`,
    recipient_email: params.recipientEmail,
    save_card_for_future_charges: false,
    upfront_percent: 100,
    auto_charge_remainder: false,
    line_items: lineItems,
  });

  return { invoice, pricing };
}

async function removeTicketInvoiceTransferFeeLines(
  supabase: SupabaseClient,
  invoiceId: number,
  orgId: number,
) {
  await supabase
    .from("client_invoice_line_items")
    .delete()
    .eq("invoice_id", invoiceId)
    .eq("org_id", orgId)
    .ilike("description", "transfer fee");
}

export async function prepareTicketInvoiceDraft(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    ticketId: number;
    baseUrl?: string;
    pricingOverride?: Partial<SupplementPricingInput>;
  },
) {
  const { ticket, recipientEmail } = await loadTicketForInvoice(
    supabase,
    params.orgId,
    params.ticketId,
  );

  if (ticket.invoice_id) {
    const { data: existing } = await supabase
      .from("client_invoices")
      .select("*")
      .eq("id", ticket.invoice_id)
      .eq("org_id", params.orgId)
      .maybeSingle();

    if (existing?.status === "draft") {
      await removeTicketInvoiceTransferFeeLines(
        supabase,
        Number(existing.id),
        params.orgId,
      );

      const pricing = await syncDraftInvoiceFromDeliverables(
        supabase,
        params.orgId,
        Number(existing.id),
        ticket,
      );

      const { data: lineItems } = await supabase
        .from("client_invoice_line_items")
        .select("*")
        .eq("invoice_id", existing.id)
        .eq("org_id", params.orgId)
        .order("sort_order", { ascending: true });

      const { data: refreshedInvoice } = await supabase
        .from("client_invoices")
        .select("*")
        .eq("id", existing.id)
        .eq("org_id", params.orgId)
        .maybeSingle();

      const invoiceWithNotes = refreshedInvoice ?? existing;
      const notes = await ensureTicketInvoiceTermsAndConditions(
        supabase,
        Number(existing.id),
        params.orgId,
        invoiceWithNotes.notes,
      );

      const baseUrl = (params.baseUrl?.trim() || resolvePublicAppBaseUrl())
        .replace(/\/$/, "");
      const { url } = await ensureShareLink(
        supabase,
        Number(existing.id),
        params.orgId,
        baseUrl,
      );

      return {
        invoice: { ...invoiceWithNotes, notes },
        line_items: lineItems ?? [],
        payment_url: url,
        to: recipientEmail,
        pricing,
      };
    }

    if (existing && existing.status !== "void") {
      throw new Error("This ticket already has an invoice");
    }
  }

  const { invoice, pricing } = await createDraftInvoiceForTicket(supabase, {
    orgId: params.orgId,
    ticket,
    recipientEmail,
    pricingOverride: params.pricingOverride,
  });

  const now = new Date().toISOString();
  await supabase
    .from("tickets")
    .update({
      invoice_id: invoice.id,
      updated_at: now,
    })
    .eq("id", ticket.id)
    .eq("org_id", params.orgId);

  const { data: lineItems } = await supabase
    .from("client_invoice_line_items")
    .select("*")
    .eq("invoice_id", invoice.id)
    .eq("org_id", params.orgId)
    .order("sort_order", { ascending: true });

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

  return {
    invoice,
    line_items: lineItems ?? [],
    payment_url: url,
    to: recipientEmail,
    pricing,
  };
}

export async function cancelTicketInvoiceDraft(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    ticketId: number;
  },
) {
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, invoice_id, delivery_status")
    .eq("id", params.ticketId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!ticket?.invoice_id) {
    return { cancelled: false, skipped: true };
  }

  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("id, status")
    .eq("id", ticket.invoice_id)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!invoice?.id || invoice.status !== "draft") {
    return { cancelled: false, skipped: true };
  }

  const { data: combinedLinks } = await supabase
    .from("client_invoice_tickets")
    .select("ticket_id")
    .eq("invoice_id", invoice.id)
    .eq("org_id", params.orgId);

  const ticketIdsToClear =
    combinedLinks && combinedLinks.length > 1
      ? combinedLinks.map((link) => Number(link.ticket_id))
      : [ticket.id];

  await deleteStandaloneClientInvoice(supabase, Number(invoice.id), params.orgId);

  const now = new Date().toISOString();
  for (const ticketId of ticketIdsToClear) {
    const { data: ticketRow } = await supabase
      .from("tickets")
      .select("delivery_status")
      .eq("id", ticketId)
      .eq("org_id", params.orgId)
      .maybeSingle();

    const nextDeliveryStatus =
      ticketRow?.delivery_status === "invoice_sent"
        ? "ready"
        : ticketRow?.delivery_status;

    await supabase
      .from("tickets")
      .update({
        invoice_id: null,
        delivery_status: nextDeliveryStatus,
        updated_at: now,
      })
      .eq("id", ticketId)
      .eq("org_id", params.orgId);
  }

  if (combinedLinks && combinedLinks.length > 1) {
    await supabase
      .from("client_invoice_tickets")
      .delete()
      .eq("invoice_id", invoice.id)
      .eq("org_id", params.orgId);
  }

  return { cancelled: true, invoice_id: invoice.id };
}

export async function sendTicketInvoicePaymentLink(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    memberId: number;
    ticketId: number;
    baseUrl?: string;
    message?: string;
    subject?: string;
    smsTo?: string;
    sendSms?: boolean;
  },
) {
  const { ticket, recipientEmail } = await loadTicketForInvoice(
    supabase,
    params.orgId,
    params.ticketId,
  );

  if (!ticket.invoice_id) {
    throw new Error("Prepare the invoice before sending");
  }

  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("*")
    .eq("id", ticket.invoice_id)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!invoice?.id) {
    throw new Error("Invoice not found");
  }
  if (invoice.status !== "draft") {
    throw new Error("This invoice was already sent");
  }

  const { count: combinedCount } = await supabase
    .from("client_invoice_tickets")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoice.id)
    .eq("org_id", params.orgId);

  if ((combinedCount ?? 0) > 1) {
    throw new Error(
      "This is a combined ticket invoice. Send it from the bulk Create invoice action.",
    );
  }

  if (!(await isOrgTransactionalEmailConfigured(params.orgId))) {
    throw new Error("Email is not configured for your organization");
  }

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
  }).format(Number(invoice.amount) || 0);

  const { subject, textBody, htmlBody } = buildTicketPaymentEmailBodies({
    orgName,
    invoiceNumber: invoice.invoice_number,
    amountFormatted: balanceFormatted,
    paymentUrl: url,
    customMessage: params.message,
    subject: params.subject,
    propertyAddress: ticket.subject,
  });

  const now = new Date().toISOString();

  await sendTransactionalEmail({
    orgId: params.orgId,
    orgName,
    to: recipientEmail,
    subject,
    textBody,
    htmlBody,
  });

  let smsOutcome: { sent: boolean; skipped: boolean } | null = null;
  if (params.sendSms && params.smsTo?.trim()) {
    const deliverables = await loadTicketDeliverablesForBilling(
      supabase,
      params.orgId,
      ticket.id,
      { onlyUninvoiced: false },
    );
    let recipientFirstName: string | null = null;
    if (ticket.contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("first_name")
        .eq("id", ticket.contact_id)
        .eq("org_id", params.orgId)
        .maybeSingle();
      recipientFirstName = contact?.first_name ?? null;
    }
    const serviceSubject = resolveTicketSmsServiceSubject(
      deliverables,
      ticket.subject,
    );

    smsOutcome = await sendTicketInvoiceSms(supabase, {
      orgId: params.orgId,
      memberId: params.memberId,
      phoneRaw: params.smsTo.trim(),
      body: buildTicketPaymentSmsText({
        orgName,
        paymentUrl: url,
        recipientFirstName,
        serviceSubject,
      }),
      contactId: ticket.contact_id ?? null,
    });
  }

  await supabase
    .from("client_invoices")
    .update({
      status: "sent",
      sent_at: now,
      updated_at: now,
    })
    .eq("id", invoice.id)
    .eq("org_id", params.orgId);

  await supabase
    .from("tickets")
    .update({
      status: "waiting",
      delivery_status: "invoice_sent",
      updated_at: now,
    })
    .eq("id", ticket.id)
    .eq("org_id", params.orgId);

  await supabase
    .from("ticket_deliverables")
    .update({ invoiced_invoice_id: invoice.id })
    .eq("ticket_id", ticket.id)
    .eq("org_id", params.orgId)
    .is("invoiced_invoice_id", null);

  const { data: member } = await supabase
    .from("organization_members")
    .select("first_name, last_name, email")
    .eq("id", params.memberId)
    .maybeSingle();
  const memberName =
    [member?.first_name, member?.last_name].filter(Boolean).join(" ").trim() ||
    member?.email?.trim() ||
    "Team";

  const fromEmail =
    (await getTransactionalFromEmail(params.orgId)) ??
    INVOICE_ORGANIZATION_NAME;

  const noteContext = await loadTicketInvoiceSentNoteContext(supabase, {
    orgId: params.orgId,
    ticketId: ticket.id,
    invoiceNumber: invoice.invoice_number,
    amountFormatted: balanceFormatted,
    dueDate: invoice.due_date,
    recipientEmail,
    propertyAddress: ticket.subject,
    senderName: memberName,
    fromEmail,
    sentAt: now,
    smsTo: params.sendSms ? params.smsTo : null,
    smsSent: smsOutcome?.sent ?? false,
    smsSkipped: smsOutcome?.skipped ?? false,
  });

  await supabase.from("ticket_messages").insert({
    ticket_id: ticket.id,
    author_member_id: params.memberId,
    body: buildTicketInvoiceSentInternalNoteBody(noteContext),
    direction: "internal",
    from_name: memberName,
    created_at: now,
  });

  return {
    invoice: { ...invoice, status: "sent", sent_at: now },
    payment_url: url,
    to: recipientEmail,
    sms_sent: smsOutcome?.sent ?? false,
    sms_skipped: smsOutcome?.skipped ?? !params.sendSms,
  };
}

export async function startNewTicketInvoiceCycle(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    memberId: number;
    ticketId: number;
  },
) {
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, invoice_id, delivery_status")
    .eq("id", params.ticketId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!ticket?.id) {
    throw new Error("Ticket not found");
  }

  let invoiceId = ticket.invoice_id ? Number(ticket.invoice_id) : null;

  if (!invoiceId) {
    const { data: linkedInvoice } = await supabase
      .from("client_invoices")
      .select("id, invoice_number, status")
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .in("status", ["sent", "paid"])
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (linkedInvoice?.id) {
      invoiceId = linkedInvoice.id;
    }
  }

  if (!invoiceId) {
    const { data: draft } = await supabase
      .from("client_invoices")
      .select("id")
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .eq("status", "draft")
      .maybeSingle();

    if (draft?.id) {
      throw new Error(
        "Finish or cancel the current invoice before starting a new one",
      );
    }

    const { count: unbilledCount } = await supabase
      .from("ticket_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .is("invoiced_invoice_id", null);

    return {
      previous_invoice_number: null,
      unbilled_deliverable_count: unbilledCount ?? 0,
      already_in_new_cycle: true,
    };
  }

  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("id, invoice_number, status")
    .eq("id", invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!invoice?.id) {
    throw new Error("Invoice not found");
  }
  if (invoice.status !== "sent" && invoice.status !== "paid") {
    throw new Error(
      "Finish or cancel the current invoice before starting a new one",
    );
  }

  const { count: unbilledCount } = await supabase
    .from("ticket_deliverables")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticket.id)
    .eq("org_id", params.orgId)
    .is("invoiced_invoice_id", null);

  const now = new Date().toISOString();

  // Keep client_invoices.ticket_id on the previous invoice so payment still delivers its files.

  await supabase
    .from("tickets")
    .update({
      invoice_id: null,
      delivery_status: (unbilledCount ?? 0) > 0 ? "ready" : "none",
      updated_at: now,
    })
    .eq("id", ticket.id)
    .eq("org_id", params.orgId);

  const { data: member } = await supabase
    .from("organization_members")
    .select("first_name, last_name, email")
    .eq("id", params.memberId)
    .maybeSingle();
  const memberName =
    [member?.first_name, member?.last_name].filter(Boolean).join(" ").trim() ||
    member?.email?.trim() ||
    "Team";

  await supabase.from("ticket_messages").insert({
    ticket_id: ticket.id,
    author_member_id: params.memberId,
    body: [
      "**New invoice cycle started**",
      "",
      `- **Previous invoice:** ${invoice.invoice_number} (${invoice.status})`,
      `- **Unbilled files:** ${unbilledCount ?? 0}`,
      "",
      unbilledCount
        ? "Add or review delivery files, then create and send the new invoice. The client will receive a new payment link."
        : "Upload new delivery files, then create and send a new invoice.",
    ].join("\n"),
    direction: "internal",
    from_name: memberName,
    created_at: now,
  });

  return {
    previous_invoice_number: invoice.invoice_number,
    unbilled_deliverable_count: unbilledCount ?? 0,
  };
}

export async function createTicketInvoiceAndSendPaymentLink(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    memberId: number;
    ticketId: number;
    baseUrl?: string;
    pricingOverride?: Partial<SupplementPricingInput>;
    message?: string;
  },
) {
  await prepareTicketInvoiceDraft(supabase, {
    orgId: params.orgId,
    ticketId: params.ticketId,
    baseUrl: params.baseUrl,
    pricingOverride: params.pricingOverride,
  });

  return sendTicketInvoicePaymentLink(supabase, {
    orgId: params.orgId,
    memberId: params.memberId,
    ticketId: params.ticketId,
    baseUrl: params.baseUrl,
    message: params.message,
  });
}
