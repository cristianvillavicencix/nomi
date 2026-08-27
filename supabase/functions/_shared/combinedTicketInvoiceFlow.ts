import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { resolveContactEmail } from "./clientProposalBilling.ts";
import {
  createStandaloneClientInvoice,
  deleteStandaloneClientInvoice,
} from "./clientInvoiceFlow.ts";
import { DEFAULT_INVOICE_TERMS_AND_CONDITIONS } from "./invoiceDefaults.ts";
import { INVOICE_ORGANIZATION_NAME } from "./invoiceOrganizationInfo.ts";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "./transactionalEmail.ts";
import {
  formatSenderPreview,
  getOrgInvoiceEmailSendOptions,
  resolveOrgBillingFrom,
} from "./organizationEmailSenders.ts";
import { resolvePublicAppBaseUrl } from "./publicAppUrl.ts";
import {
  allDeliverablesHaveBilling,
  calculateCombinedTicketPricing,
} from "./supplementPricing.ts";
import {
  buildTicketInvoiceSentInternalNoteBody,
  loadTicketInvoiceSentNoteContext,
} from "./ticketInvoiceInternalNoteSummary.ts";
import {
  buildTicketPaymentEmailBodies,
  buildTicketPaymentEmailSubject,
  ensureShareLink,
  sendTicketInvoiceSms,
} from "./ticketInvoiceFlow.ts";
import {
  parseInvoiceRecipientEmailList,
  parseInvoiceRecipientPhoneList,
} from "./invoiceRecipientLists.ts";
import {
  buildTicketPaymentSmsText,
  resolveTicketSmsServiceSubject,
} from "./ticketInvoiceCopy.ts";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TicketRow = {
  id: number;
  org_id: number;
  subject: string;
  status: string;
  company_id?: number | null;
  contact_id?: number | null;
  deal_id?: number | null;
  requester_email?: string | null;
  invoice_id?: number | null;
  merged_into_ticket_id?: number | null;
  billing_item_count?: number | null;
  billing_has_roof?: boolean | null;
  billing_has_siding?: boolean | null;
  billing_has_esx?: boolean | null;
  billing_has_pdf_analysis?: boolean | null;
  delivery_status?: string | null;
};

const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const normalizeTicketIds = (ticketIds: number[]) =>
  [
    ...new Set(
      ticketIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)),
    ),
  ].sort((a, b) => a - b);

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

async function loadUninvoicedDeliverables(
  supabase: SupabaseClient,
  orgId: number,
  ticketId: number,
) {
  const { data } = await supabase
    .from("ticket_deliverables")
    .select("billing_kind, billing_line_count, service_package_id, title")
    .eq("ticket_id", ticketId)
    .eq("org_id", orgId)
    .is("invoiced_invoice_id", null)
    .order("sort_order", { ascending: true });

  return data ?? [];
}

async function loadInvoiceTicketLinks(
  supabase: SupabaseClient,
  orgId: number,
  invoiceId: number,
) {
  const { data } = await supabase
    .from("client_invoice_tickets")
    .select("ticket_id, is_primary")
    .eq("invoice_id", invoiceId)
    .eq("org_id", orgId)
    .order("ticket_id", { ascending: true });

  return data ?? [];
}

async function resolveRecipientEmail(
  supabase: SupabaseClient,
  ticket: TicketRow,
) {
  const contactEmail = ticket.contact_id
    ? await resolveContactEmail(supabase, ticket.contact_id)
    : null;

  return (
    ticket.requester_email?.trim().toLowerCase() ||
    contactEmail?.trim().toLowerCase() ||
    ""
  );
}

async function loadTicketsForCombinedInvoice(
  supabase: SupabaseClient,
  orgId: number,
  ticketIds: number[],
  selectedRecipientEmail?: string | null,
) {
  const normalizedIds = normalizeTicketIds(ticketIds);
  if (normalizedIds.length < 2) {
    throw new Error("Select at least two tickets for a combined invoice");
  }

  const { data: tickets } = await supabase
    .from("tickets")
    .select(
      "id, org_id, subject, status, company_id, contact_id, deal_id, requester_email, invoice_id, merged_into_ticket_id, billing_item_count, billing_has_roof, billing_has_siding, billing_has_esx, billing_has_pdf_analysis, delivery_status",
    )
    .eq("org_id", orgId)
    .in("id", normalizedIds);

  const rows = (tickets ?? []) as TicketRow[];
  if (rows.length !== normalizedIds.length) {
    throw new Error("One or more tickets were not found");
  }

  const ordered = normalizedIds.map(
    (id) => rows.find((row) => Number(row.id) === id)!,
  );

  for (const ticket of ordered) {
    if (ticket.merged_into_ticket_id) {
      throw new Error(`Ticket #${ticket.id} was merged and cannot be invoiced`);
    }
    if (!ticket.company_id && !ticket.contact_id) {
      throw new Error(
        `Link a company or contact on ticket #${ticket.id} before invoicing`,
      );
    }

    const deliverables = await loadUninvoicedDeliverables(
      supabase,
      orgId,
      ticket.id,
    );
    if (!deliverables.length) {
      throw new Error(
        `Upload at least one delivery file on ticket #${ticket.id} before invoicing`,
      );
    }
    if (!allDeliverablesHaveBilling(deliverables)) {
      throw new Error(
        `Set billing for each delivery file on ticket #${ticket.id}`,
      );
    }

    if (ticket.invoice_id) {
      const { data: invoice } = await supabase
        .from("client_invoices")
        .select("id, status")
        .eq("id", ticket.invoice_id)
        .eq("org_id", orgId)
        .maybeSingle();

      if (invoice?.status === "draft") {
        const links = await loadInvoiceTicketLinks(
          supabase,
          orgId,
          Number(invoice.id),
        );
        const linkedIds = normalizeTicketIds(
          links.map((link) => Number(link.ticket_id)),
        );
        const sameSet =
          linkedIds.length === normalizedIds.length &&
          linkedIds.every((id, index) => id === normalizedIds[index]);
        if (!sameSet) {
          throw new Error(
            `Ticket #${ticket.id} already has a draft invoice. Cancel it first.`,
          );
        }
      } else if (invoice && invoice.status !== "void") {
        throw new Error(
          `Ticket #${ticket.id} already has an active invoice. Start a new invoice cycle first.`,
        );
      }
    }
  }

  const recipientEmails = await Promise.all(
    ordered.map((ticket) => resolveRecipientEmail(supabase, ticket)),
  );
  const availableEmails = [
    ...new Set(
      recipientEmails.filter((email) => email && emailRegex.test(email)),
    ),
  ];

  if (!availableEmails.length) {
    throw new Error("Add a valid recipient email before sending an invoice");
  }

  const parsedSelection = selectedRecipientEmail?.trim()
    ? parseInvoiceRecipientEmailList(selectedRecipientEmail)
    : [];
  let recipientEmail = "";

  if (parsedSelection.length > 0) {
    for (const email of parsedSelection) {
      if (!availableEmails.includes(email)) {
        throw new Error(
          "Recipient email must match one of the selected ticket emails",
        );
      }
    }
    recipientEmail = parsedSelection.join(", ");
  } else if (availableEmails.length === 1) {
    recipientEmail = availableEmails[0]!;
  } else {
    throw new Error("Select a recipient email for the combined invoice");
  }

  return {
    tickets: ordered,
    ticketIds: normalizedIds,
    primaryTicket: ordered[0]!,
    recipientEmail: recipientEmail,
  };
}

async function buildCombinedPricing(
  supabase: SupabaseClient,
  orgId: number,
  tickets: TicketRow[],
) {
  const catalogPackages = await loadTicketCatalogPackages(supabase, orgId);
  const pricingInputs = await Promise.all(
    tickets.map(async (ticket) => ({
      ticket,
      propertyAddress: ticket.subject?.trim() || "Property",
      deliverables: await loadUninvoicedDeliverables(
        supabase,
        orgId,
        ticket.id,
      ),
    })),
  );

  return calculateCombinedTicketPricing(pricingInputs, catalogPackages);
}

async function removeTransferFeeLines(
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

async function syncCombinedDraftInvoice(
  supabase: SupabaseClient,
  orgId: number,
  invoiceId: number,
  tickets: TicketRow[],
) {
  const pricing = await buildCombinedPricing(supabase, orgId, tickets);
  if (!pricing.lines.length) {
    throw new Error("Configure billing on each delivery file before sending");
  }

  await removeTransferFeeLines(supabase, invoiceId, orgId);
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

  const ticketLabels = tickets.map((ticket) => `#${ticket.id}`).join(", ");
  const propertySummary = tickets
    .map((ticket) => ticket.subject?.trim() || `Ticket #${ticket.id}`)
    .join(" · ");
  const now = new Date().toISOString();

  const { error: invoiceError } = await supabase
    .from("client_invoices")
    .update({
      subtotal: pricing.subtotal,
      fee_amount: pricing.transferFee,
      amount: pricing.total,
      description: `Combined ticket invoice · Tickets ${ticketLabels}`,
      reference: `Tickets ${ticketLabels} · ${propertySummary}`,
      updated_at: now,
    })
    .eq("id", invoiceId)
    .eq("org_id", orgId);

  if (invoiceError) {
    throw new Error(invoiceError.message ?? "Could not update invoice totals");
  }

  return pricing;
}

async function linkTicketsToInvoice(
  supabase: SupabaseClient,
  orgId: number,
  invoiceId: number,
  ticketIds: number[],
  primaryTicketId: number,
) {
  await supabase
    .from("client_invoice_tickets")
    .delete()
    .eq("invoice_id", invoiceId)
    .eq("org_id", orgId);

  const rows = ticketIds.map((ticketId) => ({
    org_id: orgId,
    invoice_id: invoiceId,
    ticket_id: ticketId,
    is_primary: ticketId === primaryTicketId,
  }));

  const { error } = await supabase.from("client_invoice_tickets").insert(rows);
  if (error) {
    throw new Error(error.message ?? "Could not link tickets to invoice");
  }

  const now = new Date().toISOString();
  for (const ticketId of ticketIds) {
    await supabase
      .from("tickets")
      .update({ invoice_id: invoiceId, updated_at: now })
      .eq("id", ticketId)
      .eq("org_id", orgId);
  }
}

export async function prepareCombinedTicketInvoiceDraft(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    ticketIds: number[];
    baseUrl?: string;
    recipientEmail?: string;
  },
) {
  const { tickets, ticketIds, primaryTicket, recipientEmail } =
    await loadTicketsForCombinedInvoice(
      supabase,
      params.orgId,
      params.ticketIds,
      params.recipientEmail,
    );

  const existingDraftId = primaryTicket.invoice_id
    ? Number(primaryTicket.invoice_id)
    : null;
  let invoiceId = existingDraftId;

  if (existingDraftId) {
    const { data: existing } = await supabase
      .from("client_invoices")
      .select("*")
      .eq("id", existingDraftId)
      .eq("org_id", params.orgId)
      .maybeSingle();

    if (existing?.status === "draft") {
      await syncCombinedDraftInvoice(
        supabase,
        params.orgId,
        existingDraftId,
        tickets,
      );
      await linkTicketsToInvoice(
        supabase,
        params.orgId,
        existingDraftId,
        ticketIds,
        primaryTicket.id,
      );
      await supabase
        .from("client_invoices")
        .update({
          recipient_email: recipientEmail,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingDraftId)
        .eq("org_id", params.orgId);
    } else if (existing && existing.status !== "void") {
      throw new Error(
        "One of the selected tickets already has an active invoice",
      );
    } else {
      invoiceId = null;
    }
  }

  if (!invoiceId) {
    const pricing = await buildCombinedPricing(supabase, params.orgId, tickets);
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = addDays(today, 7);
    const ticketLabels = tickets.map((ticket) => `#${ticket.id}`).join(", ");
    const propertySummary = tickets
      .map((ticket) => ticket.subject?.trim() || `Ticket #${ticket.id}`)
      .join(" · ");

    const invoice = await createStandaloneClientInvoice(
      supabase,
      params.orgId,
      {
        company_id: primaryTicket.company_id ?? null,
        contact_id: primaryTicket.contact_id ?? null,
        deal_id: primaryTicket.deal_id ?? null,
        ticket_id: primaryTicket.id,
        issue_date: today,
        due_date: dueDate,
        terms: "Due on receipt",
        notes: DEFAULT_INVOICE_TERMS_AND_CONDITIONS,
        subtotal: pricing.subtotal,
        fee_amount: pricing.transferFee,
        amount: pricing.total,
        description: `Combined ticket invoice · Tickets ${ticketLabels}`,
        reference: `Tickets ${ticketLabels} · ${propertySummary}`,
        recipient_email: recipientEmail,
        save_card_for_future_charges: false,
        upfront_percent: 100,
        auto_charge_remainder: false,
        line_items: pricing.lines.map((line, index) => ({
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unit_price: line.unitPrice,
          sort_order: index,
        })),
      },
    );

    invoiceId = Number(invoice.id);
    await linkTicketsToInvoice(
      supabase,
      params.orgId,
      invoiceId,
      ticketIds,
      primaryTicket.id,
    );
  }

  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  const { data: lineItems } = await supabase
    .from("client_invoice_line_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("org_id", params.orgId)
    .order("sort_order", { ascending: true });

  const baseUrl = (params.baseUrl?.trim() || resolvePublicAppBaseUrl()).replace(
    /\/$/,
    "",
  );
  const { url } = await ensureShareLink(
    supabase,
    invoiceId,
    params.orgId,
    baseUrl,
  );

  const pricing = await buildCombinedPricing(supabase, params.orgId, tickets);

  return {
    invoice,
    line_items: lineItems ?? [],
    payment_url: url,
    to: recipientEmail,
    ticket_ids: ticketIds,
    pricing,
  };
}

export async function cancelCombinedTicketInvoiceDraft(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    ticketIds: number[];
  },
) {
  const ticketIds = normalizeTicketIds(params.ticketIds);
  if (ticketIds.length < 2) {
    return { cancelled: false, skipped: true };
  }

  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, invoice_id, delivery_status")
    .eq("org_id", params.orgId)
    .in("id", ticketIds);

  const rows = tickets ?? [];
  const invoiceIds = new Set(
    rows
      .map((ticket) => ticket.invoice_id)
      .filter((id): id is number => id != null)
      .map((id) => Number(id)),
  );

  if (invoiceIds.size !== 1) {
    return { cancelled: false, skipped: true };
  }

  const invoiceId = [...invoiceIds][0]!;
  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("id, status")
    .eq("id", invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!invoice?.id || invoice.status !== "draft") {
    return { cancelled: false, skipped: true };
  }

  const links = await loadInvoiceTicketLinks(supabase, params.orgId, invoiceId);
  if (links.length < 2) {
    return { cancelled: false, skipped: true };
  }

  await deleteStandaloneClientInvoice(supabase, invoiceId, params.orgId);

  const now = new Date().toISOString();
  for (const ticket of rows) {
    const nextDeliveryStatus =
      ticket.delivery_status === "invoice_sent"
        ? "ready"
        : ticket.delivery_status;
    await supabase
      .from("tickets")
      .update({
        invoice_id: null,
        delivery_status: nextDeliveryStatus,
        updated_at: now,
      })
      .eq("id", ticket.id)
      .eq("org_id", params.orgId);
  }

  await supabase
    .from("client_invoice_tickets")
    .delete()
    .eq("invoice_id", invoiceId)
    .eq("org_id", params.orgId);

  return { cancelled: true, invoice_id: invoiceId, ticket_ids: ticketIds };
}

export async function sendCombinedTicketInvoicePaymentLink(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    memberId: number;
    ticketIds: number[];
    baseUrl?: string;
    message?: string;
    subject?: string;
    smsTo?: string;
    sendSms?: boolean;
    recipientEmail?: string;
  },
) {
  const { tickets, ticketIds, primaryTicket, recipientEmail } =
    await loadTicketsForCombinedInvoice(
      supabase,
      params.orgId,
      params.ticketIds,
      params.recipientEmail,
    );

  const invoiceId = primaryTicket.invoice_id
    ? Number(primaryTicket.invoice_id)
    : null;
  if (!invoiceId) {
    throw new Error("Prepare the combined invoice before sending");
  }

  const links = await loadInvoiceTicketLinks(supabase, params.orgId, invoiceId);
  if (links.length < 2) {
    throw new Error("This is not a combined ticket invoice");
  }

  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!invoice?.id) {
    throw new Error("Invoice not found");
  }
  if (invoice.status !== "draft") {
    throw new Error("This invoice was already sent");
  }

  if (!(await isOrgTransactionalEmailConfigured(params.orgId))) {
    throw new Error("Email is not configured for your organization");
  }

  await syncCombinedDraftInvoice(supabase, params.orgId, invoiceId, tickets);

  await supabase
    .from("client_invoices")
    .update({
      recipient_email: recipientEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("org_id", params.orgId);

  const { data: refreshedInvoice } = await supabase
    .from("client_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  const invoiceRow = refreshedInvoice ?? invoice;

  const baseUrl = (params.baseUrl?.trim() || resolvePublicAppBaseUrl()).replace(
    /\/$/,
    "",
  );
  const { url } = await ensureShareLink(
    supabase,
    invoiceId,
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
  }).format(Number(invoiceRow.amount) || 0);

  const propertySummary = tickets
    .map((ticket) => ticket.subject?.trim() || `Ticket #${ticket.id}`)
    .join(" · ");

  const deliverablesByTicket = await Promise.all(
    tickets.map((ticket) =>
      loadUninvoicedDeliverables(supabase, params.orgId, ticket.id),
    ),
  );
  const serviceLines = deliverablesByTicket.flatMap((items) =>
    items.map((item) => item.title),
  );

  const { subject, textBody, htmlBody } = buildTicketPaymentEmailBodies({
    orgName,
    invoiceNumber: invoiceRow.invoice_number,
    amountFormatted: balanceFormatted,
    paymentUrl: url,
    customMessage: params.message,
    subject:
      params.subject?.trim() || buildTicketPaymentEmailSubject(propertySummary),
    propertyAddress: propertySummary,
    serviceLines,
  });

  const now = new Date().toISOString();

  const invoiceEmail = await getOrgInvoiceEmailSendOptions(params.orgId, orgName);

  const recipientEmails = parseInvoiceRecipientEmailList(recipientEmail);

  await sendTransactionalEmail({
    orgId: params.orgId,
    orgName,
    to: recipientEmails,
    subject,
    textBody,
    htmlBody,
    ...invoiceEmail,
    emailChannel: "billing",
  });

  let smsOutcome: { sent: boolean; skipped: boolean } | null = null;
  if (params.sendSms && params.smsTo?.trim()) {
    const smsPhones = parseInvoiceRecipientPhoneList(params.smsTo);
    if (!smsPhones.length) {
      throw new Error("Enter a valid US mobile number for text delivery");
    }

    const allDeliverables = (
      await Promise.all(
        tickets.map((ticket) =>
          loadUninvoicedDeliverables(supabase, params.orgId, ticket.id),
        ),
      )
    ).flat();

    let recipientFirstName: string | null = null;
    if (primaryTicket.contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("first_name")
        .eq("id", primaryTicket.contact_id)
        .eq("org_id", params.orgId)
        .maybeSingle();
      recipientFirstName = contact?.first_name ?? null;
    }

    smsOutcome = { sent: false, skipped: false };
    for (const smsPhone of smsPhones) {
      const outcome = await sendTicketInvoiceSms(supabase, {
        orgId: params.orgId,
        memberId: params.memberId,
        phoneRaw: smsPhone,
        body: buildTicketPaymentSmsText({
          orgName,
          paymentUrl: url,
          recipientFirstName,
          serviceSubject: resolveTicketSmsServiceSubject(
            allDeliverables,
            propertySummary,
          ),
        }),
        contactId: primaryTicket.contact_id ?? null,
      });
      if (outcome.sent) smsOutcome.sent = true;
      if (outcome.skipped) smsOutcome.skipped = true;
    }
  }

  await supabase
    .from("client_invoices")
    .update({
      status: "sent",
      sent_at: now,
      updated_at: now,
    })
    .eq("id", invoiceId)
    .eq("org_id", params.orgId);

  for (const ticket of tickets) {
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
      .update({ invoiced_invoice_id: invoiceId })
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .is("invoiced_invoice_id", null);
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("first_name, last_name, email")
    .eq("id", params.memberId)
    .maybeSingle();
  const memberName =
    [member?.first_name, member?.last_name].filter(Boolean).join(" ").trim() ||
    member?.email?.trim() ||
    "Team";
  const billingFrom = await resolveOrgBillingFrom(params.orgId, orgName);
  const fromEmail = formatSenderPreview(billingFrom);

  for (const ticket of tickets) {
    const noteContext = await loadTicketInvoiceSentNoteContext(supabase, {
      orgId: params.orgId,
      ticketId: ticket.id,
      invoiceId,
      invoiceNumber: invoiceRow.invoice_number,
      amountFormatted: balanceFormatted,
      dueDate: invoiceRow.due_date,
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
  }

  return {
    invoice: { ...invoiceRow, status: "sent", sent_at: now },
    payment_url: url,
    to: recipientEmail,
    ticket_ids: ticketIds,
    sms_sent: smsOutcome?.sent ?? false,
    sms_skipped: smsOutcome?.skipped ?? !params.sendSms,
  };
}

export async function loadCombinedInvoiceTicketIds(
  supabase: SupabaseClient,
  orgId: number,
  invoiceId: number,
) {
  const links = await loadInvoiceTicketLinks(supabase, orgId, invoiceId);
  if (links.length > 0) {
    return links.map((link) => Number(link.ticket_id));
  }
  return [];
}
