import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  computeInvoiceRemainderTarget,
  generateOriginalInvoiceBalanceCharges,
  parseInvoiceRemainderSchedule,
  rescheduleRemainderAfterEarlyPayments,
} from "./invoiceRemainderSchedule.ts";

type InvoicePaymentRow = {
  id: number;
  org_id: number;
  amount: number;
  amount_paid: number;
  status: string;
  upfront_percent?: number | null;
  auto_charge_remainder?: boolean | null;
  save_card_for_future_charges?: boolean | null;
  due_date?: string | null;
  issue_date?: string | null;
  remainder_schedule?: Record<string, unknown> | null;
  stripe_payment_intent_id?: string | null;
};

export async function applyClientInvoicePaymentUpdate(
  supabase: SupabaseClient,
  params: {
    invoice: InvoicePaymentRow;
    chargeAmount: number;
    stripePaymentIntentId: string;
    newlyPaidInstallmentNumbers?: number[];
    stripeCustomerId?: string | null;
    stripePaymentMethodId?: string | null;
    paymentMethodBrand?: string | null;
    paymentMethodLast4?: string | null;
    clearAutoChargeError?: boolean;
  },
) {
  const invoice = params.invoice;
  const total = Number(invoice.amount) || 0;
  const paid = Number(invoice.amount_paid) || 0;
  const upfrontPercent = Number(invoice.upfront_percent ?? 100);
  const now = new Date().toISOString();

  if (invoice.stripe_payment_intent_id === params.stripePaymentIntentId) {
    return { duplicate: true, invoice };
  }

  const newPaid = Math.round((paid + params.chargeAmount) * 100) / 100;
  const isPaidInFull = newPaid >= total - 0.01;
  const nextStatus = isPaidInFull ? "paid" : "sent";

  const remainderInstallmentNumbers = (params.newlyPaidInstallmentNumbers ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  let nextRemainderSchedule: Record<string, unknown> | null =
    (invoice.remainder_schedule as Record<string, unknown> | null) ?? null;

  if (!isPaidInFull && remainderInstallmentNumbers.length > 0) {
    const scheduleConfig = parseInvoiceRemainderSchedule(
      invoice.remainder_schedule,
      invoice.due_date ?? now.slice(0, 10),
    );
    const balanceAmount = computeInvoiceRemainderTarget(total, upfrontPercent);
    const originalCharges = generateOriginalInvoiceBalanceCharges({
      balanceAmount,
      config: scheduleConfig,
      invoiceDueDate: invoice.due_date ?? now.slice(0, 10),
      issueDate: invoice.issue_date ?? now.slice(0, 10),
    });
    nextRemainderSchedule = rescheduleRemainderAfterEarlyPayments({
      config: scheduleConfig,
      allCharges: originalCharges,
      newlyPaidInstallmentNumbers: remainderInstallmentNumbers,
    }) as Record<string, unknown>;
  }

  const { data: updated, error } = await supabase
    .from("client_invoices")
    .update({
      amount_paid: newPaid,
      status: nextStatus,
      paid_at: isPaidInFull ? now : null,
      sent_at: invoice.status === "draft" ? now : undefined,
      stripe_payment_intent_id: params.stripePaymentIntentId,
      remainder_schedule: isPaidInFull ? null : nextRemainderSchedule,
      ...(params.stripeCustomerId
        ? { stripe_customer_id: params.stripeCustomerId }
        : {}),
      ...(params.stripePaymentMethodId
        ? { stripe_payment_method_id: params.stripePaymentMethodId }
        : {}),
      ...(params.paymentMethodBrand
        ? { payment_method_brand: params.paymentMethodBrand }
        : {}),
      ...(params.paymentMethodLast4
        ? { payment_method_last4: params.paymentMethodLast4 }
        : {}),
      ...(params.clearAutoChargeError ? { last_auto_charge_error: null } : {}),
      updated_at: now,
    })
    .eq("id", invoice.id)
    .eq("org_id", invoice.org_id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    invoice: updated,
    charged_amount: params.chargeAmount,
    amount_paid: newPaid,
    balance_due: Math.max(Math.round((total - newPaid) * 100) / 100, 0),
    paid_in_full: isPaidInFull,
  };
}
