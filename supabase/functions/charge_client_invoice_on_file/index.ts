import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import {
  amountToCents,
  createOffSessionInvoicePaymentIntent,
  isStripeMockMode,
} from "../_shared/clientProposalBilling.ts";
import { applyClientInvoicePaymentUpdate } from "../_shared/clientInvoicePayment.ts";
import { getStripe } from "../_shared/stripeClient.ts";
import {
  getUnpaidRemainderChargesDueBy,
  parseInvoiceRemainderSchedule,
} from "../_shared/invoiceRemainderSchedule.ts";
import { notifyInvoicePaymentReceipt } from "../_shared/invoicePaymentEmails.ts";

type ChargeBody = {
  invoice_id?: number;
  amount?: number;
};

const STRIPE_MIN_USD = 0.5;

const resolveStaffChargeTarget = (
  invoice: {
    amount: number;
    amount_paid?: number | null;
    upfront_percent?: number | null;
    issue_date?: string | null;
    due_date?: string | null;
    remainder_schedule?: Record<string, unknown> | null;
  },
  requestedAmount?: number | null,
) => {
  const today = new Date().toISOString().slice(0, 10);
  const total = Number(invoice.amount) || 0;
  const paid = Number(invoice.amount_paid) || 0;
  const balance = Math.max(Math.round((total - paid) * 100) / 100, 0);

  if (balance <= 0.01) {
    return { ok: false as const, message: "This invoice has no balance due" };
  }

  const upfrontPercent = Number(invoice.upfront_percent ?? 100);
  const depositTarget =
    Math.round(
      total * (Math.min(Math.max(upfrontPercent, 1), 100) / 100) * 100,
    ) / 100;
  const depositPaid = paid >= depositTarget - 0.01;

  let chargeAmount = balance;
  let installmentNumber: number | null = null;

  if (depositPaid && upfrontPercent < 100) {
    const scheduleConfig = parseInvoiceRemainderSchedule(
      invoice.remainder_schedule,
      invoice.due_date ?? today,
    );
    const dueCharges = getUnpaidRemainderChargesDueBy({
      total,
      upfrontPercent,
      config: scheduleConfig,
      invoiceDueDate: invoice.due_date ?? today,
      issueDate: invoice.issue_date ?? today,
      asOfDate: today,
    });
    const next = dueCharges[0];
    if (next) {
      chargeAmount = Math.min(next.amount, balance);
      installmentNumber = next.installment_number;
    }
  } else if (!depositPaid) {
    chargeAmount =
      Math.min(Math.max(depositTarget - paid, 0), balance) || balance;
  }

  if (requestedAmount != null && Number.isFinite(Number(requestedAmount))) {
    const amount = Math.round(Number(requestedAmount) * 100) / 100;
    if (amount < 0.01) {
      return {
        ok: false as const,
        message: "Payment amount must be at least $0.01",
      };
    }
    if (amount > balance + 0.001) {
      return {
        ok: false as const,
        message: "Payment amount cannot exceed the balance due",
      };
    }
    chargeAmount = amount;
  }

  if (balance > STRIPE_MIN_USD && chargeAmount < STRIPE_MIN_USD) {
    return {
      ok: false as const,
      message:
        "Each card payment must be at least $0.50. Use Enter card now or send a secure payment link.",
    };
  }

  if (balance <= STRIPE_MIN_USD && chargeAmount > balance + 0.001) {
    chargeAmount = balance;
  }

  return {
    ok: true as const,
    chargeAmount,
    balance,
    installmentNumber,
    newlyPaidInstallmentNumbers: installmentNumber ? [installmentNumber] : [],
  };
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      try {
        const member = await getUserOrganizationMember(user);
        if (!member?.id) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (
          !member.administrator &&
          !hasMemberCapability(member, "proposals.send")
        ) {
          return createErrorResponse(403, "You cannot charge invoices");
        }

        if (isStripeMockMode()) {
          return createErrorResponse(
            400,
            "Stripe billing is disabled in this environment",
          );
        }

        const body = (await req.json()) as ChargeBody;
        const invoiceId = Number(body.invoice_id);
        if (!Number.isFinite(invoiceId)) {
          return createErrorResponse(400, "Invalid invoice_id");
        }

        const { data: invoice } = await supabaseAdmin
          .from("client_invoices")
          .select(
            "id, org_id, amount, amount_paid, currency, status, upfront_percent, issue_date, due_date, remainder_schedule, stripe_customer_id, stripe_payment_method_id, payment_method_brand, payment_method_last4",
          )
          .eq("id", invoiceId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (!invoice?.id) {
          return createErrorResponse(404, "Invoice not found");
        }

        if (invoice.status === "void" || invoice.status === "paid") {
          return createErrorResponse(
            409,
            "This invoice is already paid or void",
          );
        }

        const customerId = invoice.stripe_customer_id?.trim();
        const paymentMethodId = invoice.stripe_payment_method_id?.trim();
        if (!customerId || !paymentMethodId) {
          return createErrorResponse(
            400,
            "No card is on file for this invoice. Enter a card or send a secure payment link.",
          );
        }

        const target = resolveStaffChargeTarget(
          invoice,
          body.amount != null ? Number(body.amount) : null,
        );
        if (!target.ok) {
          return createErrorResponse(400, target.message);
        }

        const stripe = getStripe();
        const amountCents = amountToCents(target.chargeAmount);
        const today = new Date().toISOString().slice(0, 10);
        const idempotencyKey = `invoice-staff-${invoice.id}-${amountCents}-${today}-${Date.now()}`;

        const paymentIntent = await createOffSessionInvoicePaymentIntent(
          stripe,
          {
            amountCents,
            currency: invoice.currency ?? "usd",
            customerId,
            paymentMethodId,
            idempotencyKey,
            metadata: {
              type: "client_invoice",
              org_id: String(invoice.org_id),
              invoice_id: String(invoice.id),
              remainder_installment_number: target.installmentNumber
                ? String(target.installmentNumber)
                : "0",
              auto_charge: "0",
              staff_charge: "1",
            },
          },
        );

        if (paymentIntent.status === "requires_action") {
          return createErrorResponse(
            402,
            "This card requires customer authentication. Enter the card with the client present or send a secure payment link.",
          );
        }

        if (paymentIntent.status !== "succeeded") {
          return createErrorResponse(
            400,
            `Payment could not be completed (${paymentIntent.status})`,
          );
        }

        const result = await applyClientInvoicePaymentUpdate(supabaseAdmin, {
          invoice,
          chargeAmount: target.chargeAmount,
          stripePaymentIntentId: paymentIntent.id,
          newlyPaidInstallmentNumbers: target.newlyPaidInstallmentNumbers,
          stripeCustomerId: customerId,
          stripePaymentMethodId: paymentMethodId,
          paymentMethodBrand: invoice.payment_method_brand,
          paymentMethodLast4: invoice.payment_method_last4,
          clearAutoChargeError: true,
        });

        const receipt = await notifyInvoicePaymentReceipt(supabaseAdmin, {
          orgId: invoice.org_id,
          invoiceId: invoice.id,
          stripePaymentIntentId: paymentIntent.id,
          chargedAmount: target.chargeAmount,
        });

        return new Response(
          JSON.stringify({
            invoice: result.invoice,
            charged_amount: target.chargeAmount,
            amount_paid: result.amount_paid,
            balance_due: result.balance_due,
            paid_in_full: result.paid_in_full,
            receipt_sent: receipt.sent,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("charge_client_invoice_on_file.error", error);
        const message =
          error instanceof Error ? error.message : "Unexpected error";
        if (
          message.toLowerCase().includes("authentication") ||
          message.toLowerCase().includes("off_session")
        ) {
          return createErrorResponse(
            402,
            "This card requires customer authentication. Enter the card with the client present or send a secure payment link.",
          );
        }
        return createErrorResponse(500, message);
      }
    });
  }),
);
