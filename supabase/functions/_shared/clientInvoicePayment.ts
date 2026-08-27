import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  computeInvoiceRemainderTarget,
  generateOriginalInvoiceBalanceCharges,
  parseInvoiceRemainderSchedule,
  rescheduleRemainderAfterEarlyPayments,
} from "./invoiceRemainderSchedule.ts";
import { markInstallmentPaidFromStripe } from "./proposalFlow.ts";
import {
  deliverTicketAfterInvoicePayment,
  noteTicketDeliveryFailure,
} from "./ticketDelivery.ts";
import { logError, logWarn, logInfo, logDebug } from "./structuredLogger.ts";

const isDepositInstallment = (row: {
  installment_number?: number | null;
  label?: string | null;
}) =>
  row.installment_number === 1 ||
  row.label?.toLowerCase().includes("deposit") === true;

/** After an invoice linked to a proposal installment is paid, sync proposal/deal state. */
export async function syncProposalInstallmentFromPaidInvoice(
  supabase: SupabaseClient,
  params: {
    invoiceId: number;
    orgId: number;
    stripePaymentIntentId: string;
    paymentMethod?: string;
  },
) {
  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("id, org_id, status, installment_id, proposal_id, deal_id")
    .eq("id", params.invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (
    !invoice?.installment_id ||
    !invoice.proposal_id ||
    invoice.status !== "paid"
  ) {
    return { synced: false };
  }

  const installmentId = Number(invoice.installment_id);
  const proposalId = Number(invoice.proposal_id);

  const [{ data: installment }, { data: proposal }] = await Promise.all([
    supabase
      .from("proposal_payment_installments")
      .select("id, installment_number, label, status")
      .eq("id", installmentId)
      .eq("org_id", params.orgId)
      .maybeSingle(),
    supabase
      .from("proposals")
      .select("id, deal_id, contract_id")
      .eq("id", proposalId)
      .eq("org_id", params.orgId)
      .maybeSingle(),
  ]);

  if (!installment?.id) {
    return { synced: false, reason: "installment_not_found" };
  }

  if (installment.status === "paid") {
    return { synced: true, alreadyPaid: true };
  }

  const dealId = invoice.deal_id ?? proposal?.deal_id ?? null;
  const contractId = proposal?.contract_id ?? null;

  return markInstallmentPaidFromStripe(supabase, {
    orgId: params.orgId,
    proposalId,
    dealId,
    contractId,
    installmentId,
    stripePaymentIntentId: params.stripePaymentIntentId,
    paymentMethod: params.paymentMethod ?? "stripe",
    isDeposit: isDepositInstallment(installment),
    skipInvoiceUpdate: true,
  });
}

type InvoicePaymentRow = {
  id: number;
  org_id: number;
  proposal_id?: number | null;
  ticket_id?: number | null;
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

/** True when this Stripe PI charge is already reflected in amount_paid. */
export function isInvoiceStripePaymentAlreadyApplied(
  invoice: Pick<InvoicePaymentRow, "amount_paid" | "stripe_payment_intent_id">,
  params: { stripePaymentIntentId: string; chargeAmount: number },
) {
  if (
    !params.stripePaymentIntentId ||
    invoice.stripe_payment_intent_id !== params.stripePaymentIntentId
  ) {
    return false;
  }

  const paid = Number(invoice.amount_paid) || 0;
  return paid >= params.chargeAmount - 0.01;
}

export async function propagateProposalCardToSiblingInvoices(
  supabase: SupabaseClient,
  orgId: number,
  proposalId: number,
  card: {
    stripeCustomerId?: string | null;
    stripePaymentMethodId?: string | null;
    paymentMethodBrand?: string | null;
    paymentMethodLast4?: string | null;
  },
) {
  if (!card.stripePaymentMethodId) return;

  await supabase
    .from("client_invoices")
    .update({
      ...(card.stripeCustomerId
        ? { stripe_customer_id: card.stripeCustomerId }
        : {}),
      stripe_payment_method_id: card.stripePaymentMethodId,
      ...(card.paymentMethodBrand
        ? { payment_method_brand: card.paymentMethodBrand }
        : {}),
      ...(card.paymentMethodLast4
        ? { payment_method_last4: card.paymentMethodLast4 }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("proposal_id", proposalId)
    .is("stripe_payment_method_id", null)
    .in("status", ["draft", "sent"]);
}

export async function updateInvoiceDeliveryStatus(
  supabase: SupabaseClient,
  invoiceId: number,
  orgId: number,
  status: string,
  errorMessage?: string | null,
) {
  const { error } = await supabase
    .from("client_invoices")
    .update({
      delivery_status: status,
      delivery_status_at: new Date().toISOString(),
      delivery_error_message: errorMessage?.trim() || null,
    })
    .eq("id", invoiceId)
    .eq("org_id", orgId);

  if (error) {
    await logError({
      module: "clientInvoicePayment",
      operation: "updateInvoiceDeliveryStatus",
      error: error,
      context: { invoiceId, orgId, status },
      orgId,
      invoiceId,
    });
  }
}

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
  const alreadyPaidInFull = invoice.status === "paid" || paid >= total - 0.01;

  // Never stack a second charge onto an invoice that is already settled,
  // even if Stripe returns a different PaymentIntent id.
  if (alreadyPaidInFull) {
    const balanceDue = Math.max(Math.round((total - paid) * 100) / 100, 0);

    // Intentar delivery incluso si invoice.ticket_id es null - el sistema mejorado tiene fallbacks
    try {
      const deliveryResult = await deliverTicketAfterInvoicePayment(supabase, {
        invoiceId: invoice.id,
        orgId: invoice.org_id,
      });

      await logInfo({
        module: "clientInvoicePayment",
        operation: "deliverTicket.alreadyPaid",
        message: "Delivery attempt for already-paid invoice",
        context: {
          invoiceId: invoice.id,
          ticketId: invoice.ticket_id,
          deliveryResult,
        },
        orgId: invoice.org_id,
      });
    } catch (error) {
      await logError({
        module: "clientInvoicePayment",
        operation: "deliverTicket.alreadyPaid",
        error: error,
        context: {
          invoiceId: invoice.id,
          ticketId: invoice.ticket_id,
        },
        orgId: invoice.org_id,
      });

      // Solo notificar fallo si tenemos un ticket_id conocido
      if (invoice.ticket_id) {
        await noteTicketDeliveryFailure(supabase, {
          ticketId: Number(invoice.ticket_id),
          error,
        });
      }
    }

    return {
      duplicate: true,
      invoice,
      charged_amount: 0,
      amount_paid: paid,
      balance_due: balanceDue,
      paid_in_full: true,
    };
  }

  if (
    isInvoiceStripePaymentAlreadyApplied(invoice, {
      stripePaymentIntentId: params.stripePaymentIntentId,
      chargeAmount: params.chargeAmount,
    })
  ) {
    const balanceDue = Math.max(Math.round((total - paid) * 100) / 100, 0);
    const paidInFull = paid >= total - 0.01;

    if (paidInFull) {
      try {
        await syncProposalInstallmentFromPaidInvoice(supabase, {
          invoiceId: invoice.id,
          orgId: invoice.org_id,
          stripePaymentIntentId: params.stripePaymentIntentId,
        });
      } catch (error) {
        await logError({
          module: "clientInvoicePayment",
          operation: "syncProposalInstallment.duplicate",
          error: error,
          context: {
            invoiceId: invoice.id,
            installmentId: invoice.installment_id,
          },
          orgId: invoice.org_id,
          invoiceId: invoice.id,
        });
      }

      // Intentar delivery con el sistema mejorado que tiene fallbacks
      try {
        const deliveryResult = await deliverTicketAfterInvoicePayment(
          supabase,
          {
            invoiceId: invoice.id,
            orgId: invoice.org_id,
          },
        );

        await logInfo({
          module: "clientInvoicePayment",
          operation: "deliverTicket.duplicate",
          message: "Delivery attempt for duplicate payment",
          context: {
            invoiceId: invoice.id,
            ticketId: invoice.ticket_id,
            deliveryResult,
          },
          orgId: invoice.org_id,
        });
      } catch (error) {
        await logError({
          module: "clientInvoicePayment",
          operation: "deliverTicket.duplicate",
          error: error,
          context: {
            invoiceId: invoice.id,
            ticketId: invoice.ticket_id,
          },
          orgId: invoice.org_id,
        });

        // Solo notificar fallo si tenemos un ticket_id conocido
        if (invoice.ticket_id) {
          await noteTicketDeliveryFailure(supabase, {
            ticketId: Number(invoice.ticket_id),
            error,
          });
        }
      }
    }

    return {
      duplicate: true,
      invoice,
      charged_amount: params.chargeAmount,
      amount_paid: paid,
      balance_due: balanceDue,
      paid_in_full: paidInFull,
    };
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

  if (params.stripePaymentMethodId && invoice.proposal_id) {
    await propagateProposalCardToSiblingInvoices(
      supabase,
      invoice.org_id,
      Number(invoice.proposal_id),
      {
        stripeCustomerId: params.stripeCustomerId,
        stripePaymentMethodId: params.stripePaymentMethodId,
        paymentMethodBrand: params.paymentMethodBrand,
        paymentMethodLast4: params.paymentMethodLast4,
      },
    );
  }

  if (isPaidInFull) {
    await updateInvoiceDeliveryStatus(
      supabase,
      invoice.id,
      invoice.org_id,
      "payment_received",
    );

    try {
      await syncProposalInstallmentFromPaidInvoice(supabase, {
        invoiceId: invoice.id,
        orgId: invoice.org_id,
        stripePaymentIntentId: params.stripePaymentIntentId,
      });
    } catch (error) {
      await logError({
        module: "clientInvoicePayment",
        operation: "syncProposalInstallment",
        error: error,
        context: {
          invoiceId: invoice.id,
          installmentId: invoice.installment_id,
        },
        orgId: invoice.org_id,
        invoiceId: invoice.id,
      });
    }

    if (updated?.ticket_id) {
      await updateInvoiceDeliveryStatus(
        supabase,
        invoice.id,
        invoice.org_id,
        "delivering_files",
      );
      try {
        await deliverTicketAfterInvoicePayment(supabase, {
          invoiceId: invoice.id,
          orgId: invoice.org_id,
        });
        await updateInvoiceDeliveryStatus(
          supabase,
          invoice.id,
          invoice.org_id,
          "delivery_succeeded",
        );
      } catch (error) {
        await logError({
          module: "clientInvoicePayment",
          operation: "deliverTicket.paidInFull",
          error: error,
          context: {
            invoiceId: invoice.id,
            ticketId: updated.ticket_id,
          },
          orgId: invoice.org_id,
          invoiceId: invoice.id,
          ticketId: Number(updated.ticket_id),
        });
        await updateInvoiceDeliveryStatus(
          supabase,
          invoice.id,
          invoice.org_id,
          "delivery_failed",
          error instanceof Error ? error.message : "Unknown delivery error",
        );
        await noteTicketDeliveryFailure(supabase, {
          ticketId: Number(updated.ticket_id),
          error,
        });
      }
    } else {
      await updateInvoiceDeliveryStatus(
        supabase,
        invoice.id,
        invoice.org_id,
        "delivery_succeeded",
      );
    }
  }

  return {
    invoice: updated,
    charged_amount: params.chargeAmount,
    amount_paid: newPaid,
    balance_due: Math.max(Math.round((total - newPaid) * 100) / 100, 0),
    paid_in_full: isPaidInFull,
  };
}
