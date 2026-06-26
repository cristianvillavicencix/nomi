import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type PublicInvoicePayBody = {
  public_token?: string;
  amount?: number;
  remainder_installment_numbers?: number[];
};

export type ResolvedPublicInvoicePayment = {
  invoice: {
    id: number;
    org_id: number;
    proposal_id: number | null;
    contact_id: number | null;
    company_id: number | null;
    amount: number;
    amount_paid: number;
    currency: string | null;
    status: string;
    upfront_percent: number | null;
    save_card_for_future_charges: boolean | null;
    auto_charge_remainder: boolean | null;
    stripe_payment_intent_id: string | null;
    stripe_customer_id: string | null;
    stripe_payment_method_id: string | null;
    recipient_email: string | null;
    issue_date: string | null;
    due_date: string | null;
    remainder_schedule: Record<string, unknown> | null;
  };
  chargeAmount: number;
  remainderInstallmentNumbers: number[];
  balance: number;
};

export async function resolvePublicClientInvoicePayment(
  supabase: SupabaseClient,
  body: PublicInvoicePayBody,
): Promise<
  | { ok: true; data: ResolvedPublicInvoicePayment }
  | { ok: false; status: number; message: string }
> {
  const token = String(body.public_token ?? "").trim();
  if (!token) {
    return { ok: false, status: 400, message: "Missing public_token" };
  }

  const { data: tokenRow } = await supabase
    .from("public_client_invoice_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) {
    return { ok: false, status: 403, message: "Invalid or expired link" };
  }

  if (
    tokenRow.expires_at &&
    new Date(tokenRow.expires_at).getTime() < Date.now()
  ) {
    return { ok: false, status: 410, message: "This invoice link has expired" };
  }

  const { data: invoice } = await supabase
    .from("client_invoices")
    .select(
      "id, org_id, proposal_id, ticket_id, contact_id, company_id, amount, amount_paid, currency, status, upfront_percent, save_card_for_future_charges, auto_charge_remainder, stripe_payment_intent_id, stripe_customer_id, stripe_payment_method_id, recipient_email, issue_date, due_date, remainder_schedule",
    )
    .eq("id", tokenRow.invoice_id)
    .eq("org_id", tokenRow.org_id)
    .maybeSingle();

  if (!invoice?.id) {
    return { ok: false, status: 404, message: "Invoice not found" };
  }

  if (invoice.status === "void" || invoice.status === "paid") {
    return {
      ok: false,
      status: 409,
      message: "This invoice is already paid or void",
    };
  }

  const total = Number(invoice.amount) || 0;
  const paid = Number(invoice.amount_paid) || 0;
  const balance = Math.max(Math.round((total - paid) * 100) / 100, 0);
  if (balance <= 0) {
    return { ok: false, status: 409, message: "This invoice is already paid" };
  }

  const STRIPE_MIN_USD = 0.5;

  const upfrontPercent = Number(invoice.upfront_percent ?? 100);
  const targetUpfront =
    Math.round(
      total * (Math.min(Math.max(upfrontPercent, 1), 100) / 100) * 100,
    ) / 100;
  const defaultChargeAmount =
    Math.min(
      Math.max(Math.round((targetUpfront - paid) * 100) / 100, 0),
      balance,
    ) || balance;

  const requestedAmount =
    body.amount != null && Number.isFinite(Number(body.amount))
      ? Math.round(Number(body.amount) * 100) / 100
      : null;

  let chargeAmount = defaultChargeAmount;
  if (requestedAmount != null) {
    if (requestedAmount < 0.01) {
      return {
        ok: false,
        status: 400,
        message: "Payment amount must be at least $0.01",
      };
    }
    if (requestedAmount > balance + 0.001) {
      return {
        ok: false,
        status: 400,
        message: "Payment amount cannot exceed the balance due",
      };
    }
    chargeAmount = requestedAmount;
  }

  if (balance > STRIPE_MIN_USD && chargeAmount < STRIPE_MIN_USD) {
    return {
      ok: false,
      status: 400,
      message:
        "Each card payment must be at least $0.50. Select another installment or pay the remaining balance.",
    };
  }

  if (balance <= STRIPE_MIN_USD && chargeAmount > balance + 0.001) {
    chargeAmount = balance;
  }

  const remainderInstallmentNumbers = Array.isArray(
    body.remainder_installment_numbers,
  )
    ? body.remainder_installment_numbers
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  return {
    ok: true,
    data: {
      invoice,
      chargeAmount,
      remainderInstallmentNumbers,
      balance,
    },
  };
}

export const buildInvoicePaymentIntentMetadata = (
  invoice: ResolvedPublicInvoicePayment["invoice"],
  remainderInstallmentNumbers: number[],
) => ({
  type: "client_invoice" as const,
  org_id: String(invoice.org_id),
  invoice_id: String(invoice.id),
  ...(remainderInstallmentNumbers.length > 0
    ? {
        remainder_installment_numbers: remainderInstallmentNumbers.join(","),
      }
    : {}),
});

export const parseRemainderInstallmentNumbersFromMetadata = (
  metadata: Record<string, string> | null | undefined,
) => {
  const raw =
    metadata?.remainder_installment_numbers ??
    metadata?.remainder_installment_number;
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
};
