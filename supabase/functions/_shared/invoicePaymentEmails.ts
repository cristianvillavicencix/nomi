import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  applyRemainderScheduleToCharges,
  computeInvoiceRemainderTarget,
  generateOriginalInvoiceBalanceCharges,
  parseInvoiceRemainderSchedule,
} from "./invoiceRemainderSchedule.ts";
import {
  INVOICE_ORGANIZATION_EMAIL,
  INVOICE_ORGANIZATION_NAME,
  INVOICE_ORGANIZATION_PHONE,
  INVOICE_ORGANIZATION_WEBSITE,
} from "./invoiceOrganizationInfo.ts";
import {
  isStripeMockMode,
  resolveContactEmail,
} from "./clientProposalBilling.ts";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "./transactionalEmail.ts";
import { getOrgInvoiceEmailSendOptions } from "./organizationEmailSenders.ts";
import {
  buildPaymentReceiptFilename,
  generatePaymentReceiptPdfBase64,
} from "./invoicePaymentReceiptPdf.ts";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";
import { getStripeForOrg } from "./stripeClient.ts";
import { resolvePublicAppBaseUrl } from "./publicAppUrl.ts";
import { sendOrgSms } from "./sendOrgSms.ts";

const formatMoney = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(Number(amount) || 0);

const formatDate = (dateKey: string) => {
  const parsed = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function resolveInvoicePortalUrl(
  supabase: SupabaseClient,
  invoiceId: number,
  orgId: number,
  options?: { openPayment?: boolean },
) {
  const { data: tokenRow } = await supabase
    .from("public_client_invoice_tokens")
    .select("token, short_code")
    .eq("invoice_id", invoiceId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseUrl = resolvePublicAppBaseUrl();
  // Default to ticket-style payment entry unless explicitly disabled.
  const openPayment = options?.openPayment !== false;
  const payQuery = openPayment ? "?pay=1" : "";
  if (tokenRow?.short_code) {
    return `${baseUrl}/iv/${tokenRow.short_code}${payQuery}`;
  }
  if (tokenRow?.token) {
    return `${baseUrl}/portal/invoice/${tokenRow.token}${payQuery}`;
  }
  return baseUrl;
}

async function resolveInvoiceBillToName(
  supabase: SupabaseClient,
  invoice: {
    contact_id?: number | null;
    company_id?: number | null;
  },
) {
  let companyName: string | null = null;
  let contactName: string | null = null;

  if (invoice.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", invoice.company_id)
      .maybeSingle();
    companyName = company?.name?.trim() || null;
  }

  if (invoice.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", invoice.contact_id)
      .maybeSingle();
    contactName =
      [contact?.first_name, contact?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || null;
  }

  return companyName ?? contactName ?? "Client";
}

async function resolvePaymentReceiptDate(
  orgId: number,
  stripePaymentIntentId: string,
) {
  const today = new Date().toISOString().slice(0, 10);
  if (isStripeMockMode()) return today;

  try {
    const stripe = await getStripeForOrg(orgId);
    const intent = await stripe.paymentIntents.retrieve(stripePaymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = intent.latest_charge as { created?: number } | null;
    if (charge?.created) {
      return new Date(charge.created * 1000).toISOString().slice(0, 10);
    }
  } catch (error) {
    console.warn("invoicePaymentEmails.receipt_date_lookup_failed", error);
  }

  return today;
}

async function resolveInvoiceRecipientEmail(
  supabase: SupabaseClient,
  invoice: {
    contact_id?: number | null;
    recipient_email?: string | null;
  },
) {
  const fromContact = await resolveContactEmail(supabase, invoice.contact_id);
  return fromContact?.trim() || invoice.recipient_email?.trim() || null;
}

async function hasEmailBeenSent(
  supabase: SupabaseClient,
  invoiceId: number,
  referenceKey: string,
) {
  const { data } = await supabase
    .from("client_invoice_email_logs")
    .select("id, delivery_status")
    .eq("invoice_id", invoiceId)
    .eq("reference_key", referenceKey)
    .maybeSingle();
  return data?.delivery_status === "sent";
}

type InvoiceNotificationLogType =
  | "payment_receipt"
  | "payment_reminder"
  | "payment_receipt_sms";

const extractPrimaryPhoneE164 = (phoneJsonb: unknown): string | null => {
  if (!Array.isArray(phoneJsonb)) return null;
  for (const entry of phoneJsonb) {
    if (!entry || typeof entry !== "object") continue;
    const number = (entry as { number?: string }).number;
    if (typeof number === "string" && number.trim()) {
      const normalized = normalizeUsPhoneToE164(number);
      if (normalized) return normalized;
    }
  }
  return null;
};

async function resolveInvoiceRecipientPhone(
  supabase: SupabaseClient,
  invoice: InvoiceEmailRow,
): Promise<string | null> {
  if (!invoice.contact_id) return null;
  const { data: contact } = await supabase
    .from("contacts")
    .select("phone_jsonb")
    .eq("id", invoice.contact_id)
    .eq("org_id", invoice.org_id)
    .maybeSingle();
  return extractPrimaryPhoneE164(contact?.phone_jsonb);
}

async function logEmailAttempt(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    invoiceId: number;
    emailType: InvoiceNotificationLogType;
    referenceKey: string;
    recipientEmail: string;
    deliveryStatus: "sent" | "failed" | "skipped";
    errorMessage?: string | null;
  },
) {
  const { error } = await supabase.from("client_invoice_email_logs").upsert(
    {
      org_id: params.orgId,
      invoice_id: params.invoiceId,
      email_type: params.emailType,
      reference_key: params.referenceKey,
      recipient_email: params.recipientEmail,
      delivery_status: params.deliveryStatus,
      error_message: params.errorMessage?.trim() || null,
      sent_at: new Date().toISOString(),
    },
    { onConflict: "invoice_id,reference_key" },
  );
  if (error) {
    console.warn("invoicePaymentEmails.log_attempt_failed", error.message);
  }
}

type InvoiceEmailRow = {
  id: number;
  org_id: number;
  invoice_number: string;
  amount: number;
  amount_paid?: number | null;
  currency?: string | null;
  contact_id?: number | null;
  company_id?: number | null;
  recipient_email?: string | null;
  upfront_percent?: number | null;
  auto_charge_remainder?: boolean | null;
  save_card_for_future_charges?: boolean | null;
  due_date?: string | null;
  issue_date?: string | null;
  remainder_schedule?: Record<string, unknown> | null;
  payment_method_brand?: string | null;
  payment_method_last4?: string | null;
};

export async function notifyInvoicePaymentReceipt(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    invoiceId: number;
    stripePaymentIntentId: string;
    chargedAmount: number;
    forceResend?: boolean;
  },
) {
  const { data: invoice } = await supabase
    .from("client_invoices")
    .select(
      "id, org_id, invoice_number, amount, amount_paid, currency, contact_id, company_id, recipient_email, upfront_percent, auto_charge_remainder, save_card_for_future_charges, due_date, issue_date, remainder_schedule, payment_method_brand, payment_method_last4, status",
    )
    .eq("id", params.invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!invoice?.id) {
    return { sent: false, skipped: true, reason: "invoice_not_found" as const };
  }

  const total = Number(invoice.amount) || 0;
  const paid = Number(invoice.amount_paid) || 0;
  const balanceDue = Math.max(Math.round((total - paid) * 100) / 100, 0);

  const emailResult = await sendClientInvoicePaymentReceipt(supabase, {
    invoice,
    chargedAmount: params.chargedAmount,
    stripePaymentIntentId: params.stripePaymentIntentId,
    paidInFull: invoice.status === "paid" || balanceDue <= 0.01,
    balanceDue,
    forceResend: params.forceResend,
  });

  // SMS only when a receipt email was sent (now or earlier for this payment).
  const shouldNotifySms =
    emailResult.sent === true || emailResult.reason === "duplicate";

  let sms: Awaited<ReturnType<typeof notifyInvoicePaymentReceiptSms>> | undefined;
  if (shouldNotifySms) {
    sms = await notifyInvoicePaymentReceiptSms(supabase, {
      invoice,
      stripePaymentIntentId: params.stripePaymentIntentId,
      forceResend: params.forceResend,
    });
  }

  return { ...emailResult, sms };
}

/**
 * Post-payment SMS: points the client at the receipt email (inbox/spam).
 * Failures are logged and never block payment.
 */
export async function notifyInvoicePaymentReceiptSms(
  supabase: SupabaseClient,
  params: {
    invoice: InvoiceEmailRow;
    stripePaymentIntentId: string;
    forceResend?: boolean;
  },
) {
  const referenceKey = `receipt_sms:${params.stripePaymentIntentId}`;
  try {
    if (
      !params.forceResend &&
      (await hasEmailBeenSent(supabase, params.invoice.id, referenceKey))
    ) {
      return { sent: false, skipped: true, reason: "duplicate" as const };
    }

    const toPhone = await resolveInvoiceRecipientPhone(supabase, params.invoice);
    if (!toPhone) {
      await logEmailAttempt(supabase, {
        orgId: params.invoice.org_id,
        invoiceId: params.invoice.id,
        emailType: "payment_receipt_sms",
        referenceKey,
        recipientEmail: "unknown",
        deliveryStatus: "skipped",
        errorMessage: "no_phone",
      });
      return { sent: false, skipped: true, reason: "no_phone" as const };
    }

    const settings = await getMessagingSettingsSecrets(params.invoice.org_id);
    if (!settings?.sms_enabled) {
      await logEmailAttempt(supabase, {
        orgId: params.invoice.org_id,
        invoiceId: params.invoice.id,
        emailType: "payment_receipt_sms",
        referenceKey,
        recipientEmail: toPhone,
        deliveryStatus: "skipped",
        errorMessage: "sms_not_configured",
      });
      return {
        sent: false,
        skipped: true,
        reason: "sms_not_configured" as const,
      };
    }

    const body =
      `Thanks for your payment on ${params.invoice.invoice_number}. ` +
      "We emailed your receipt and PDF attachments — please check your inbox/spam.";

    await sendOrgSms({
      orgId: params.invoice.org_id,
      to: toPhone,
      body,
    });

    await logEmailAttempt(supabase, {
      orgId: params.invoice.org_id,
      invoiceId: params.invoice.id,
      emailType: "payment_receipt_sms",
      referenceKey,
      recipientEmail: toPhone,
      deliveryStatus: "sent",
    });
    return { sent: true, skipped: false, to: toPhone };
  } catch (error) {
    const message = error instanceof Error ? error.message : "sms_send_failed";
    console.error("invoicePaymentEmails.receipt_sms_failed", error);
    await logEmailAttempt(supabase, {
      orgId: params.invoice.org_id,
      invoiceId: params.invoice.id,
      emailType: "payment_receipt_sms",
      referenceKey,
      recipientEmail: "unknown",
      deliveryStatus: "failed",
      errorMessage: message,
    });
    return {
      sent: false,
      skipped: true,
      reason: "send_failed" as const,
      error: message,
    };
  }
}

export async function sendClientInvoicePaymentReceipt(
  supabase: SupabaseClient,
  params: {
    invoice: InvoiceEmailRow;
    chargedAmount: number;
    stripePaymentIntentId: string;
    paidInFull: boolean;
    balanceDue: number;
    forceResend?: boolean;
  },
) {
  const referenceKey = `receipt:${params.stripePaymentIntentId}`;
  if (
    !params.forceResend &&
    (await hasEmailBeenSent(supabase, params.invoice.id, referenceKey))
  ) {
    return { sent: false, skipped: true, reason: "duplicate" as const };
  }

  const to = await resolveInvoiceRecipientEmail(supabase, params.invoice);
  if (!to) {
    await logEmailAttempt(supabase, {
      orgId: params.invoice.org_id,
      invoiceId: params.invoice.id,
      emailType: "payment_receipt",
      referenceKey,
      recipientEmail: "unknown",
      deliveryStatus: "skipped",
      errorMessage: "no_email",
    });
    return { sent: false, skipped: true, reason: "no_email" as const };
  }

  let emailConfigured = false;
  try {
    emailConfigured = await isOrgTransactionalEmailConfigured(
      params.invoice.org_id,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "email_config_check_failed";
    console.error("invoicePaymentEmails.receipt_config_failed", message);
    await logEmailAttempt(supabase, {
      orgId: params.invoice.org_id,
      invoiceId: params.invoice.id,
      emailType: "payment_receipt",
      referenceKey,
      recipientEmail: to,
      deliveryStatus: "failed",
      errorMessage: message,
    });
    return {
      sent: false,
      skipped: true,
      reason: "email_not_configured" as const,
      error: message,
    };
  }

  if (!emailConfigured) {
    console.warn(
      "invoicePaymentEmails.receipt_skipped",
      "Twilio email not configured for org",
      params.invoice.org_id,
    );
    await logEmailAttempt(supabase, {
      orgId: params.invoice.org_id,
      invoiceId: params.invoice.id,
      emailType: "payment_receipt",
      referenceKey,
      recipientEmail: to,
      deliveryStatus: "skipped",
      errorMessage: "email_not_configured",
    });
    return {
      sent: false,
      skipped: true,
      reason: "email_not_configured" as const,
    };
  }

  const currency = params.invoice.currency ?? "USD";
  const paymentUrl = await resolveInvoicePortalUrl(
    supabase,
    params.invoice.id,
    params.invoice.org_id,
    { openPayment: !params.paidInFull },
  );
  const chargedFormatted = formatMoney(params.chargedAmount, currency);
  const balanceFormatted = formatMoney(params.balanceDue, currency);
  const totalFormatted = formatMoney(
    Number(params.invoice.amount) || 0,
    currency,
  );
  const paidFormatted = formatMoney(
    Number(params.invoice.amount_paid) || 0,
    currency,
  );

  const cardHint = params.invoice.payment_method_last4
    ? ` (${params.invoice.payment_method_brand ?? "Card"} ····${params.invoice.payment_method_last4})`
    : "";

  const billToName = await resolveInvoiceBillToName(supabase, params.invoice);
  const paymentDate = await resolvePaymentReceiptDate(
    params.invoice.org_id,
    params.stripePaymentIntentId,
  );
  const paymentMethodLabel = params.invoice.payment_method_last4
    ? `${params.invoice.payment_method_brand ?? "Card"} ····${params.invoice.payment_method_last4}`
    : null;
  const receiptPdfBase64 = await generatePaymentReceiptPdfBase64({
    invoiceNumber: params.invoice.invoice_number,
    billToName,
    billToEmail: to,
    chargedAmount: params.chargedAmount,
    totalPaid: Number(params.invoice.amount_paid) || 0,
    invoiceTotal: Number(params.invoice.amount) || 0,
    balanceDue: params.balanceDue,
    currency,
    paidInFull: params.paidInFull,
    paymentMethodLabel,
    paymentReference: params.stripePaymentIntentId,
    paymentDate,
  });
  const receiptFilename = buildPaymentReceiptFilename(
    params.invoice.invoice_number,
    params.stripePaymentIntentId,
  );

  const subject = params.paidInFull
    ? `${INVOICE_ORGANIZATION_NAME}: Payment receipt · ${params.invoice.invoice_number} paid in full`
    : `${INVOICE_ORGANIZATION_NAME}: Payment receipt · ${params.invoice.invoice_number}`;

  const textBody = [
    "Thank you for your payment.",
    "A PDF receipt is attached to this email.",
    "",
    `Invoice: ${params.invoice.invoice_number}`,
    `Amount paid today: ${chargedFormatted}${cardHint}`,
    `Total paid to date: ${paidFormatted}`,
    `Invoice total: ${totalFormatted}`,
    params.paidInFull
      ? "Status: Paid in full"
      : `Remaining balance: ${balanceFormatted}`,
    "",
    params.paidInFull
      ? "Your invoice is paid in full. No further action is required."
      : `View your invoice or make another payment: ${paymentUrl}`,
    "",
    "Questions? Reply to this email or contact us:",
    INVOICE_ORGANIZATION_PHONE,
    INVOICE_ORGANIZATION_EMAIL,
    INVOICE_ORGANIZATION_WEBSITE,
    "",
    INVOICE_ORGANIZATION_NAME,
  ].join("\n");

  const htmlBody = `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
      <p>Thank you for your payment.</p>
      <p style="color:#64748b;font-size:13px;">A PDF receipt is attached to this email.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 0;color:#64748b;">Invoice</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(params.invoice.invoice_number)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Paid today</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(chargedFormatted)}${escapeHtml(cardHint)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Total paid</td><td style="padding:4px 0;text-align:right;">${escapeHtml(paidFormatted)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Invoice total</td><td style="padding:4px 0;text-align:right;">${escapeHtml(totalFormatted)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">${params.paidInFull ? "Status" : "Balance due"}</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(params.paidInFull ? "Paid in full" : balanceFormatted)}</td></tr>
      </table>
      ${
        params.paidInFull
          ? "<p>Your invoice is paid in full. No further action is required.</p>"
          : `<p style="margin:20px 0;"><a href="${escapeHtml(paymentUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">View invoice</a></p>`
      }
      <p style="color:#64748b;font-size:13px;">Questions? Reply to this email · ${escapeHtml(INVOICE_ORGANIZATION_PHONE)} · ${escapeHtml(INVOICE_ORGANIZATION_EMAIL)}</p>
      <p style="color:#64748b;font-size:13px;">${escapeHtml(INVOICE_ORGANIZATION_NAME)}</p>
    </div>`;

  try {
    const invoiceEmail = await getOrgInvoiceEmailSendOptions(
      params.invoice.org_id,
      INVOICE_ORGANIZATION_NAME,
    );
    const sendResult = await sendTransactionalEmail({
      orgId: params.invoice.org_id,
      orgName: INVOICE_ORGANIZATION_NAME,
      to,
      subject,
      textBody,
      htmlBody,
      ...invoiceEmail,
      emailChannel: "billing",
      attachments: [
        {
          name: receiptFilename,
          contentBase64: receiptPdfBase64,
          contentType: "application/pdf",
        },
      ],
    });
    if (sendResult.skipped) {
      console.warn(
        "invoicePaymentEmails.receipt_skipped",
        "SKIP_TRANSACTIONAL_EMAIL",
      );
      await logEmailAttempt(supabase, {
        orgId: params.invoice.org_id,
        invoiceId: params.invoice.id,
        emailType: "payment_receipt",
        referenceKey,
        recipientEmail: to,
        deliveryStatus: "skipped",
        errorMessage: "email_skipped",
      });
      return { sent: false, skipped: true, reason: "email_skipped" as const };
    }
    await logEmailAttempt(supabase, {
      orgId: params.invoice.org_id,
      invoiceId: params.invoice.id,
      emailType: "payment_receipt",
      referenceKey,
      recipientEmail: to,
      deliveryStatus: "sent",
    });
    return { sent: true, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "send_failed";
    console.error("invoicePaymentEmails.receipt_failed", error);
    await logEmailAttempt(supabase, {
      orgId: params.invoice.org_id,
      invoiceId: params.invoice.id,
      emailType: "payment_receipt",
      referenceKey,
      recipientEmail: to,
      deliveryStatus: "failed",
      errorMessage: message,
    });
    return {
      sent: false,
      skipped: true,
      reason: "send_failed" as const,
      error: error instanceof Error ? error.message : "send_failed",
    };
  }
}

export type NextInvoicePaymentTarget = {
  amount: number;
  dueDate: string;
  label: string;
  installmentNumber?: number;
  daysUntilDue: number;
  autoCharge: boolean;
};

export const resolveNextInvoicePaymentTarget = (
  invoice: InvoiceEmailRow,
  asOfDate: string,
): NextInvoicePaymentTarget | null => {
  const total = Number(invoice.amount) || 0;
  const paid = Number(invoice.amount_paid) || 0;
  const balance = Math.max(Math.round((total - paid) * 100) / 100, 0);
  if (balance <= 0.01) return null;

  const upfrontPercent = Number(invoice.upfront_percent ?? 100);
  const depositTarget = Math.round(total * (upfrontPercent / 100) * 100) / 100;
  const depositPaid = paid >= depositTarget - 0.01;
  const autoCharge = Boolean(
    invoice.auto_charge_remainder && invoice.save_card_for_future_charges,
  );

  const asOf = new Date(`${asOfDate}T12:00:00`);
  const dayMs = 24 * 60 * 60 * 1000;
  const daysUntil = (dueDate: string) =>
    Math.round(
      (new Date(`${dueDate}T12:00:00`).getTime() - asOf.getTime()) / dayMs,
    );

  if (!depositPaid) {
    const dueDate = invoice.due_date ?? asOfDate;
    return {
      amount: Math.min(depositTarget - paid, balance),
      dueDate,
      label: `Deposit (${Math.round(upfrontPercent)}%)`,
      daysUntilDue: daysUntil(dueDate),
      autoCharge: false,
    };
  }

  const config = parseInvoiceRemainderSchedule(
    invoice.remainder_schedule,
    invoice.due_date ?? asOfDate,
  );
  const remainderTarget = computeInvoiceRemainderTarget(total, upfrontPercent);
  const originalCharges = generateOriginalInvoiceBalanceCharges({
    balanceAmount: remainderTarget,
    config,
    invoiceDueDate: invoice.due_date ?? asOfDate,
    issueDate: invoice.issue_date ?? asOfDate,
  });
  const scheduled = applyRemainderScheduleToCharges(originalCharges, config);
  const paidInstallments = new Set(config.paid_installment_numbers ?? []);
  const unpaid = scheduled
    .filter((row) => !paidInstallments.has(row.installment_number))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const next = unpaid[0];
  if (!next) {
    const dueDate = invoice.due_date ?? asOfDate;
    return {
      amount: balance,
      dueDate,
      label: "Balance due",
      daysUntilDue: daysUntil(dueDate),
      autoCharge,
    };
  }

  return {
    amount: next.amount,
    dueDate: next.due_date,
    label: next.label,
    installmentNumber: next.installment_number,
    daysUntilDue: daysUntil(next.due_date),
    autoCharge,
  };
};

export type ReminderKind =
  | "upcoming_3d"
  | "upcoming_1d"
  | "due_today"
  | "overdue";

export const resolveReminderKind = (
  daysUntilDue: number,
): ReminderKind | null => {
  if (daysUntilDue === 3) return "upcoming_3d";
  if (daysUntilDue === 1) return "upcoming_1d";
  if (daysUntilDue === 0) return "due_today";
  if (daysUntilDue < 0) return "overdue";
  return null;
};

export async function sendClientInvoicePaymentReminder(
  supabase: SupabaseClient,
  params: {
    invoice: InvoiceEmailRow;
    target: NextInvoicePaymentTarget;
    reminderKind: ReminderKind;
  },
) {
  const referenceKey = `reminder:${params.target.dueDate}:${params.reminderKind}`;
  if (await hasEmailBeenSent(supabase, params.invoice.id, referenceKey)) {
    return { sent: false, skipped: true, reason: "duplicate" as const };
  }

  if (params.reminderKind === "overdue") {
    const weekAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: recentOverdue } = await supabase
      .from("client_invoice_email_logs")
      .select("id")
      .eq("invoice_id", params.invoice.id)
      .eq("email_type", "payment_reminder")
      .like("reference_key", "reminder:%:overdue")
      .gte("sent_at", weekAgo)
      .limit(1)
      .maybeSingle();
    if (recentOverdue?.id) {
      return {
        sent: false,
        skipped: true,
        reason: "overdue_cooldown" as const,
      };
    }
  }

  const to = await resolveInvoiceRecipientEmail(supabase, params.invoice);
  if (!to) {
    return { sent: false, skipped: true, reason: "no_email" as const };
  }

  if (!(await isOrgTransactionalEmailConfigured(params.invoice.org_id))) {
    return {
      sent: false,
      skipped: true,
      reason: "email_not_configured" as const,
    };
  }

  const currency = params.invoice.currency ?? "USD";
  const paymentUrl = await resolveInvoicePortalUrl(
    supabase,
    params.invoice.id,
    params.invoice.org_id,
    { openPayment: true },
  );
  const dueFormatted = formatDate(params.target.dueDate);
  const totalBalance = Math.max(
    Math.round(
      (Number(params.invoice.amount) -
        Number(params.invoice.amount_paid || 0)) *
        100,
    ) / 100,
    0,
  );
  const balanceFormatted = formatMoney(totalBalance, currency);

  const autoCharge = params.target.autoCharge;
  const headline =
    params.reminderKind === "overdue"
      ? `Payment overdue · ${params.invoice.invoice_number}`
      : params.reminderKind === "due_today"
        ? `Payment due today · ${params.invoice.invoice_number}`
        : `Upcoming payment · ${params.invoice.invoice_number}`;

  const subject = `${INVOICE_ORGANIZATION_NAME}: ${headline}`;

  const bodyIntro = autoCharge
    ? params.reminderKind === "overdue"
      ? `Your scheduled payment of ${amountFormatted} for ${params.target.label} was due on ${dueFormatted}. We could not complete the automatic charge — please pay manually.`
      : params.reminderKind === "due_today"
        ? `Your card on file will be charged ${amountFormatted} today for ${params.target.label}, unless you pay manually first.`
        : `Reminder: ${amountFormatted} for ${params.target.label} is scheduled on ${dueFormatted}. Your card on file will be charged automatically unless you pay early.`
    : params.reminderKind === "overdue"
      ? `Your payment of ${amountFormatted} for ${params.target.label} was due on ${dueFormatted}. Please pay at your earliest convenience.`
      : params.reminderKind === "due_today"
        ? `Your payment of ${amountFormatted} for ${params.target.label} is due today.`
        : `Reminder: ${amountFormatted} for ${params.target.label} is due on ${dueFormatted}.`;

  const textBody = [
    bodyIntro,
    "",
    `Invoice: ${params.invoice.invoice_number}`,
    `Next amount: ${amountFormatted}`,
    `Due date: ${dueFormatted}`,
    `Total balance remaining: ${balanceFormatted}`,
    "",
    `Pay now: ${paymentUrl}`,
    "",
    INVOICE_ORGANIZATION_NAME,
    INVOICE_ORGANIZATION_PHONE,
    INVOICE_ORGANIZATION_EMAIL,
  ].join("\n");

  const htmlBody = `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
      <p>${escapeHtml(bodyIntro)}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 0;color:#64748b;">Invoice</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(params.invoice.invoice_number)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Amount</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(amountFormatted)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Due</td><td style="padding:4px 0;text-align:right;">${escapeHtml(dueFormatted)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Balance remaining</td><td style="padding:4px 0;text-align:right;">${escapeHtml(balanceFormatted)}</td></tr>
      </table>
      <p style="margin:20px 0;"><a href="${escapeHtml(paymentUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Pay now</a></p>
      <p style="color:#64748b;font-size:13px;">${escapeHtml(INVOICE_ORGANIZATION_NAME)} · ${escapeHtml(INVOICE_ORGANIZATION_PHONE)}</p>
    </div>`;

  try {
    const invoiceEmail = await getOrgInvoiceEmailSendOptions(
      params.invoice.org_id,
      INVOICE_ORGANIZATION_NAME,
    );
    await sendTransactionalEmail({
      orgId: params.invoice.org_id,
      orgName: INVOICE_ORGANIZATION_NAME,
      to,
      subject,
      textBody,
      htmlBody,
      ...invoiceEmail,
      emailChannel: "billing",
    });
    await logEmailAttempt(supabase, {
      orgId: params.invoice.org_id,
      invoiceId: params.invoice.id,
      emailType: "payment_reminder",
      referenceKey,
      recipientEmail: to,
      deliveryStatus: "sent",
    });
    return { sent: true, skipped: false };
  } catch (error) {
    console.error("invoicePaymentEmails.reminder_failed", error);
    return {
      sent: false,
      skipped: true,
      reason: "send_failed" as const,
      error: error instanceof Error ? error.message : "send_failed",
    };
  }
}
