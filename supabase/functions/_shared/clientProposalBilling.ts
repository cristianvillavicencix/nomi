import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
// @ts-expect-error ESM from esm.sh (Deno)
import type Stripe from "https://esm.sh/stripe@14.25.0?target=deno&no-check";
import { getStripe } from "./stripeClient.ts";
import {
  markInstallmentPaidFromStripe,
} from "./proposalFlow.ts";

export type ClientPaymentMetadataType =
  | "proposal_deposit"
  | "scheduled_installment";

export type ClientPaymentMetadata = {
  type: ClientPaymentMetadataType;
  org_id: string;
  proposal_id: string;
  contract_id: string;
  installment_id: string;
  deal_id: string;
};

export const isClientPaymentMetadata = (
  metadata: Record<string, string> | null | undefined,
): metadata is ClientPaymentMetadata => {
  if (!metadata?.type) return false;
  return (
    metadata.type === "proposal_deposit" ||
    metadata.type === "scheduled_installment"
  );
};

export const buildClientPaymentMetadata = (params: {
  type: ClientPaymentMetadataType;
  orgId: number;
  proposalId: number;
  contractId: number;
  installmentId: number;
  dealId: number;
}): ClientPaymentMetadata => ({
  type: params.type,
  org_id: String(params.orgId),
  proposal_id: String(params.proposalId),
  contract_id: String(params.contractId),
  installment_id: String(params.installmentId),
  deal_id: String(params.dealId),
});

export const amountToCents = (amount: number) => Math.round(amount * 100);

export const isStripeMockMode = () => {
  const skip =
    Deno.env.get("SKIP_CLIENT_BILLING") === "1" ||
    Deno.env.get("SKIP_CLIENT_BILLING") === "true" ||
    Deno.env.get("SKIP_CLIENT_BILLING") === "yes" ||
    Deno.env.get("SKIP_CLIENT_BILLING") === "on";
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  return skip || !stripeKey;
};

export const isAuthorizedClientBillingCron = (req: Request) => {
  const secret = Deno.env.get("CRON_SECRET")?.trim();
  const header = req.headers.get("x-cron-secret")?.trim();
  if (secret && header && secret === header) {
    return true;
  }
  const auth = req.headers.get("authorization")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (serviceKey && auth === `Bearer ${serviceKey}`) {
    return true;
  }
  if (secret && auth === `Bearer ${secret}`) {
    return true;
  }
  return false;
};

type ContactEmailRow = { email?: string; isPrimary?: boolean };

export async function resolveContactEmail(
  supabase: SupabaseClient,
  contactId: number | null | undefined,
): Promise<string | null> {
  if (!contactId) return null;
  const { data } = await supabase
    .from("contacts")
    .select("email_jsonb")
    .eq("id", contactId)
    .maybeSingle();

  const emails = data?.email_jsonb as ContactEmailRow[] | null;
  return (
    emails?.find((row) => row.isPrimary)?.email?.trim() ??
    emails?.find((row) => row.email?.trim())?.email?.trim() ??
    null
  );
}

/** Stripe customer for standalone client invoices (no contract). */
export async function resolveOrCreateInvoiceStripeCustomer(
  stripe: Stripe,
  params: {
    email: string;
    name?: string;
    orgId: number;
    contactId?: number | null;
    companyId?: number | null;
    existingPaymentIntentId?: string | null;
  },
) {
  if (params.existingPaymentIntentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(
        params.existingPaymentIntentId,
      );
      const customerId =
        typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
      if (customerId) {
        const customer = await stripe.customers.retrieve(customerId);
        if (!("deleted" in customer && customer.deleted)) {
          return customer as Stripe.Customer;
        }
      }
    } catch {
      /* create a new customer below */
    }
  }

  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      org_id: String(params.orgId),
      contact_id: params.contactId ? String(params.contactId) : "",
      company_id: params.companyId ? String(params.companyId) : "",
      source: "nomi_client_invoice",
    },
  });
}

export async function applyClientInvoicePaymentFromStripe(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    invoiceId: number;
    stripePaymentIntentId: string;
    amountCents: number;
  },
) {
  const { data: invoice } = await supabase
    .from("client_invoices")
    .select(
      "id, org_id, amount, amount_paid, status, upfront_percent, auto_charge_remainder, save_card_for_future_charges",
    )
    .eq("id", params.invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!invoice?.id || invoice.status === "void" || invoice.status === "paid") {
    return { handled: false, skipped: true };
  }

  if (invoice.stripe_payment_intent_id === params.stripePaymentIntentId) {
    return { handled: true, skipped: true, duplicate: true };
  }

  const total = Number(invoice.amount) || 0;
  const paid = Number(invoice.amount_paid) || 0;
  const chargeAmount = Math.round(params.amountCents) / 100;
  const newPaid = Math.round((paid + chargeAmount) * 100) / 100;
  const isPaidInFull = newPaid >= total - 0.01;
  const now = new Date().toISOString();

  const { data: updated } = await supabase
    .from("client_invoices")
    .update({
      amount_paid: newPaid,
      status: isPaidInFull ? "paid" : "sent",
      paid_at: isPaidInFull ? now : null,
      sent_at: invoice.status === "draft" ? now : undefined,
      stripe_payment_intent_id: params.stripePaymentIntentId,
      updated_at: now,
    })
    .eq("id", invoice.id)
    .eq("org_id", params.orgId)
    .select("*")
    .single();

  return { handled: true, invoice: updated, paid_in_full: isPaidInFull };
}

export async function findDepositInstallment(
  supabase: SupabaseClient,
  proposalId: number,
) {
  const { data: byNumber } = await supabase
    .from("proposal_payment_installments")
    .select("id, amount, installment_number, label, status")
    .eq("proposal_id", proposalId)
    .eq("installment_number", 1)
    .maybeSingle();

  if (byNumber?.id) return byNumber;

  const { data: rows } = await supabase
    .from("proposal_payment_installments")
    .select("id, amount, installment_number, label, status")
    .eq("proposal_id", proposalId)
    .order("installment_number", { ascending: true });

  return (
    (rows ?? []).find((row) =>
      row.label?.toLowerCase().includes("deposit")
    ) ?? null
  );
}

export async function resolveOrCreateStripeCustomer(
  stripe: Stripe,
  params: {
    email: string;
    name?: string;
    contractId: number;
    orgId: number;
    proposalId: number;
    existingCustomerId?: string | null;
  },
) {
  if (params.existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(
        params.existingCustomerId,
      );
      if (!("deleted" in customer && customer.deleted)) {
        return customer as Stripe.Customer;
      }
    } catch {
      /* fall through to create */
    }
  }

  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      org_id: String(params.orgId),
      contract_id: String(params.contractId),
      proposal_id: String(params.proposalId),
      source: "nomi_client_proposal",
    },
  });
}

export async function attachPaymentMethodToCustomer(
  stripe: Stripe,
  customerId: string,
  paymentMethodId: string,
) {
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  return {
    brand: pm.card?.brand ?? null,
    last4: pm.card?.last4 ?? null,
  };
}

export async function createDepositPaymentIntent(
  stripe: Stripe,
  params: {
    amountCents: number;
    currency: string;
    customerId: string;
    paymentMethodId: string;
    metadata: ClientPaymentMetadata;
    idempotencyKey: string;
  },
) {
  return stripe.paymentIntents.create(
    {
      amount: params.amountCents,
      currency: params.currency.toLowerCase(),
      customer: params.customerId,
      payment_method: params.paymentMethodId,
      confirm: true,
      setup_future_usage: "off_session",
      metadata: { ...params.metadata },
    },
    { idempotencyKey: params.idempotencyKey },
  );
}

export async function createOffSessionInstallmentPaymentIntent(
  stripe: Stripe,
  params: {
    amountCents: number;
    currency: string;
    customerId: string;
    paymentMethodId: string;
    metadata: ClientPaymentMetadata;
    idempotencyKey: string;
  },
) {
  return stripe.paymentIntents.create(
    {
      amount: params.amountCents,
      currency: params.currency.toLowerCase(),
      customer: params.customerId,
      payment_method: params.paymentMethodId,
      confirm: true,
      off_session: true,
      metadata: { ...params.metadata },
    },
    { idempotencyKey: params.idempotencyKey },
  );
}

export async function logPaymentAttempt(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    contractId: number;
    installmentId: number;
    stripePaymentIntentId?: string | null;
    amountCents: number;
    status: "processing" | "succeeded" | "failed" | "requires_action";
    errorCode?: string | null;
    errorMessage?: string | null;
    retryCount?: number;
  },
) {
  await supabase.from("payment_attempt_logs").insert({
    org_id: params.orgId,
    contract_id: params.contractId,
    installment_id: params.installmentId,
    stripe_payment_intent_id: params.stripePaymentIntentId ?? null,
    amount_cents: params.amountCents,
    status: params.status,
    error_code: params.errorCode ?? null,
    error_message: params.errorMessage ?? null,
    retry_count: params.retryCount ?? 0,
  });
}

export async function getRecentAttemptCount(
  supabase: SupabaseClient,
  installmentId: number,
  hours = 24,
) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("payment_attempt_logs")
    .select("id", { count: "exact", head: true })
    .eq("installment_id", installmentId)
    .gte("attempted_at", since);
  return count ?? 0;
}

export async function handleInstallmentPaymentFailed(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    contractId: number;
    installmentId: number;
    stripePaymentIntentId?: string | null;
    amountCents: number;
    errorCode?: string | null;
    errorMessage?: string | null;
    requiresAction?: boolean;
  },
) {
  const recentAttempts = await getRecentAttemptCount(
    supabase,
    params.installmentId,
  );
  const nextStatus = params.requiresAction ? "requires_action" : "failed";

  if (!params.stripePaymentIntentId) {
    await supabase
      .from("proposal_payment_installments")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.installmentId)
      .neq("status", "paid");
    return;
  }

  await logPaymentAttempt(supabase, {
    orgId: params.orgId,
    contractId: params.contractId,
    installmentId: params.installmentId,
    stripePaymentIntentId: params.stripePaymentIntentId,
    amountCents: params.amountCents,
    status: params.requiresAction ? "requires_action" : "failed",
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    retryCount: recentAttempts,
  });

  await supabase
    .from("proposal_payment_installments")
    .update({
      status: nextStatus,
      stripe_payment_intent_id: params.stripePaymentIntentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.installmentId)
    .neq("status", "paid");
}

export async function processPaymentIntentSucceeded(
  supabase: SupabaseClient,
  paymentIntent: {
    id: string;
    amount?: number;
    metadata: Record<string, string> | null;
  },
) {
  if (paymentIntent.metadata?.type === "client_invoice") {
    const orgId = Number(paymentIntent.metadata.org_id);
    const invoiceId = Number(paymentIntent.metadata.invoice_id);
    if (!Number.isFinite(orgId) || !Number.isFinite(invoiceId)) {
      return { handled: false, error: "Invalid invoice metadata" };
    }
    return applyClientInvoicePaymentFromStripe(supabase, {
      orgId,
      invoiceId,
      stripePaymentIntentId: paymentIntent.id,
      amountCents: paymentIntent.amount ?? 0,
    });
  }

  if (!isClientPaymentMetadata(paymentIntent.metadata)) {
    return { handled: false };
  }

  const meta = paymentIntent.metadata;
  const orgId = Number(meta.org_id);
  const proposalId = Number(meta.proposal_id);
  const contractId = Number(meta.contract_id);
  const installmentId = Number(meta.installment_id);
  const dealId = Number(meta.deal_id);

  if (
    !Number.isFinite(orgId) ||
    !Number.isFinite(proposalId) ||
    !Number.isFinite(contractId) ||
    !Number.isFinite(installmentId) ||
    !Number.isFinite(dealId)
  ) {
    return { handled: false, error: "Invalid metadata" };
  }

  const result = await markInstallmentPaidFromStripe(supabase, {
    orgId,
    proposalId,
    contractId,
    dealId,
    installmentId,
    stripePaymentIntentId: paymentIntent.id,
    isDeposit: meta.type === "proposal_deposit",
  });

  return { handled: true, ...result };
}

export async function processPaymentIntentFailed(
  supabase: SupabaseClient,
  paymentIntent: {
    id: string;
    amount: number;
    metadata: Record<string, string> | null;
    last_payment_error?: {
      code?: string;
      message?: string;
      decline_code?: string;
    } | null;
    status?: string;
  },
) {
  if (!isClientPaymentMetadata(paymentIntent.metadata)) {
    return { handled: false };
  }

  const meta = paymentIntent.metadata;
  const orgId = Number(meta.org_id);
  const contractId = Number(meta.contract_id);
  const installmentId = Number(meta.installment_id);

  if (
    !Number.isFinite(orgId) ||
    !Number.isFinite(contractId) ||
    !Number.isFinite(installmentId)
  ) {
    return { handled: false };
  }

  const requiresAction =
    paymentIntent.status === "requires_action" ||
    paymentIntent.last_payment_error?.code === "authentication_required";

  await handleInstallmentPaymentFailed(supabase, {
    orgId,
    contractId,
    installmentId,
    stripePaymentIntentId: paymentIntent.id,
    amountCents: paymentIntent.amount,
    errorCode:
      paymentIntent.last_payment_error?.code ??
      paymentIntent.last_payment_error?.decline_code ??
      null,
    errorMessage: paymentIntent.last_payment_error?.message ?? null,
    requiresAction,
  });

  return { handled: true };
}

export { getStripe };
