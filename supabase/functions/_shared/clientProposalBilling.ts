import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
// @ts-expect-error ESM from esm.sh (Deno)
import type Stripe from "https://esm.sh/stripe@14.25.0?target=deno&no-check";
import { getStripe } from "./stripeClient.ts";
import {
  markInstallmentPaidFromStripe,
} from "./proposalFlow.ts";
import { applyClientInvoicePaymentUpdate } from "./clientInvoicePayment.ts";
import { parseRemainderInstallmentNumbersFromMetadata } from "./publicClientInvoicePaymentContext.ts";
import { notifyInvoicePaymentReceipt } from "./invoicePaymentEmails.ts";
import { deliverTicketAfterInvoicePayment } from "./ticketDelivery.ts";

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

/** Card + in-page wallets (Apple Pay / Google Pay). No PayPal or redirect methods. */
export const invoiceCheckoutPaymentIntentOptions = {
  payment_method_types: ["card"],
};

/** Card, Apple Pay, and Google Pay — no redirect-based payment methods. */
const walletFriendlyPaymentIntentOptions = {
  automatic_payment_methods: {
    enabled: true,
    allow_redirects: "never" as const,
  },
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
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length);
    try {
      const payload = JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ) as { role?: string };
      if (payload.role === "service_role") {
        return true;
      }
    } catch {
      // ignore malformed bearer tokens
    }
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
    existingCustomerId?: string | null;
    existingPaymentIntentId?: string | null;
  },
) {
  if (params.existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(params.existingCustomerId);
      if (!("deleted" in customer && customer.deleted)) {
        return customer as Stripe.Customer;
      }
    } catch {
      /* create a new customer below */
    }
  }

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
    metadata?: Record<string, string> | null;
  },
) {
  const { data: invoice } = await supabase
    .from("client_invoices")
    .select(
      "id, org_id, amount, amount_paid, status, ticket_id, upfront_percent, auto_charge_remainder, save_card_for_future_charges, due_date, issue_date, remainder_schedule, stripe_payment_intent_id",
    )
    .eq("id", params.invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!invoice?.id || invoice.status === "void") {
    return { handled: false, skipped: true };
  }

  if (invoice.status === "paid") {
    if (invoice.ticket_id) {
      try {
        await deliverTicketAfterInvoicePayment(supabase, {
          invoiceId: params.invoiceId,
          orgId: params.orgId,
        });
      } catch (error) {
        console.error("applyClientInvoicePaymentFromStripe.deliverTicket", error);
      }
    }
    return { handled: true, skipped: true, already_paid: true };
  }

  if (invoice.stripe_payment_intent_id === params.stripePaymentIntentId) {
    const chargedAmount = Math.round(params.amountCents) / 100;
    const receipt = await notifyInvoicePaymentReceipt(supabase, {
      orgId: params.orgId,
      invoiceId: params.invoiceId,
      stripePaymentIntentId: params.stripePaymentIntentId,
      chargedAmount,
    });
    if (!receipt.sent) {
      console.warn("applyClientInvoicePaymentFromStripe.receipt", receipt);
    }
    return { handled: true, skipped: true, duplicate: true, receipt };
  }

  const remainderInstallmentNumbers = parseRemainderInstallmentNumbersFromMetadata(
    params.metadata,
  );

  const result = await applyClientInvoicePaymentUpdate(supabase, {
    invoice,
    chargeAmount: Math.round(params.amountCents) / 100,
    stripePaymentIntentId: params.stripePaymentIntentId,
    newlyPaidInstallmentNumbers: remainderInstallmentNumbers,
    clearAutoChargeError: params.metadata?.auto_charge === "1",
  });

  await notifyInvoicePaymentReceipt(supabase, {
    orgId: params.orgId,
    invoiceId: params.invoiceId,
    stripePaymentIntentId: params.stripePaymentIntentId,
    chargedAmount: result.charged_amount,
  });

  return {
    handled: true,
    invoice: result.invoice,
    paid_in_full: result.paid_in_full,
  };
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

export async function createInvoiceCheckoutPaymentIntent(
  stripe: Stripe,
  params: {
    amountCents: number;
    currency: string;
    customerId: string;
    metadata: {
      type: "client_invoice";
      org_id: string;
      invoice_id: string;
      remainder_installment_numbers?: string;
    };
    idempotencyKey?: string;
    saveForFutureUse?: boolean;
  },
) {
  return stripe.paymentIntents.create(
    {
      amount: params.amountCents,
      currency: params.currency.toLowerCase(),
      customer: params.customerId,
      ...invoiceCheckoutPaymentIntentOptions,
      ...(params.saveForFutureUse
        ? { setup_future_usage: "off_session" as const }
        : {}),
      metadata: { ...params.metadata },
    },
    params.idempotencyKey
      ? { idempotencyKey: params.idempotencyKey }
      : undefined,
  );
}

export async function updateInvoiceCheckoutPaymentIntent(
  stripe: Stripe,
  params: {
    paymentIntentId: string;
    amountCents: number;
    invoiceId: number;
    orgId: number;
    metadata: {
      type: "client_invoice";
      org_id: string;
      invoice_id: string;
      remainder_installment_numbers?: string;
    };
  },
) {
  const intent = await stripe.paymentIntents.retrieve(params.paymentIntentId);
  const metadata = intent.metadata ?? {};

  if (
    metadata.type !== "client_invoice" ||
    Number(metadata.invoice_id) !== params.invoiceId ||
    Number(metadata.org_id) !== params.orgId
  ) {
    throw new Error("Payment does not match this invoice");
  }

  if (
    intent.status !== "requires_payment_method" &&
    intent.status !== "requires_confirmation"
  ) {
    throw new Error("Payment is already in progress");
  }

  return stripe.paymentIntents.update(params.paymentIntentId, {
    amount: params.amountCents,
    metadata: params.metadata,
  });
}

const reusableCheckoutPaymentIntentStatuses = new Set([
  "requires_payment_method",
  "requires_confirmation",
]);

export async function tryReuseInvoiceCheckoutPaymentIntent(
  stripe: Stripe,
  params: {
    paymentIntentId: string;
    amountCents: number;
    invoiceId: number;
    orgId: number;
    metadata: {
      type: "client_invoice";
      org_id: string;
      invoice_id: string;
      remainder_installment_numbers?: string;
    };
  },
): Promise<Stripe.PaymentIntent | null> {
  const paymentIntentId = params.paymentIntentId.trim();
  if (!paymentIntentId) return null;

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const metadata = intent.metadata ?? {};

    if (
      metadata.type !== "client_invoice" ||
      Number(metadata.invoice_id) !== params.invoiceId ||
      Number(metadata.org_id) !== params.orgId
    ) {
      return null;
    }

    if (!reusableCheckoutPaymentIntentStatuses.has(intent.status)) {
      return null;
    }

    return updateInvoiceCheckoutPaymentIntent(stripe, {
      paymentIntentId,
      amountCents: params.amountCents,
      invoiceId: params.invoiceId,
      orgId: params.orgId,
      metadata: params.metadata,
    });
  } catch (error) {
    console.warn("tryReuseInvoiceCheckoutPaymentIntent.failed", paymentIntentId, error);
    return null;
  }
}

export async function resolveInvoiceCheckoutPaymentIntent(
  stripe: Stripe,
  params: {
    candidatePaymentIntentIds: string[];
    amountCents: number;
    invoiceId: number;
    orgId: number;
    metadata: {
      type: "client_invoice";
      org_id: string;
      invoice_id: string;
      remainder_installment_numbers?: string;
    };
    createParams: {
      amountCents: number;
      currency: string;
      customerId: string;
      saveForFutureUse?: boolean;
      metadata: {
        type: "client_invoice";
        org_id: string;
        invoice_id: string;
        remainder_installment_numbers?: string;
      };
    };
  },
) {
  const seen = new Set<string>();
  for (const candidate of params.candidatePaymentIntentIds) {
    const paymentIntentId = candidate.trim();
    if (!paymentIntentId || seen.has(paymentIntentId)) continue;
    seen.add(paymentIntentId);

    const reused = await tryReuseInvoiceCheckoutPaymentIntent(stripe, {
      paymentIntentId,
      amountCents: params.amountCents,
      invoiceId: params.invoiceId,
      orgId: params.orgId,
      metadata: params.metadata,
    });
    if (reused) return reused;
  }

  return createInvoiceCheckoutPaymentIntent(stripe, params.createParams);
}

export async function persistInvoiceStripeCheckoutSession(
  supabase: SupabaseClient,
  params: {
    invoiceId: number;
    orgId: number;
    stripePaymentIntentId: string;
    stripeCustomerId?: string | null;
  },
) {
  const update: Record<string, string> = {
    stripe_payment_intent_id: params.stripePaymentIntentId,
  };
  if (params.stripeCustomerId?.trim()) {
    update.stripe_customer_id = params.stripeCustomerId.trim();
  }

  await supabase
    .from("client_invoices")
    .update(update)
    .eq("id", params.invoiceId)
    .eq("org_id", params.orgId)
    .neq("status", "paid")
    .neq("status", "void");
}

export async function finalizeInvoicePaymentFromIntent(
  stripe: Stripe,
  params: {
    paymentIntentId: string;
    invoice: {
      id: number;
      org_id: number;
      save_card_for_future_charges?: boolean | null;
      auto_charge_remainder?: boolean | null;
      stripe_customer_id?: string | null;
    };
    chargeAmount: number;
    remainderInstallmentNumbers: number[];
  },
) {
  const intent = await stripe.paymentIntents.retrieve(params.paymentIntentId, {
    expand: ["payment_method"],
  });

  const metadata = intent.metadata ?? {};
  if (
    metadata.type !== "client_invoice" ||
    Number(metadata.invoice_id) !== params.invoice.id ||
    Number(metadata.org_id) !== params.invoice.org_id
  ) {
    throw new Error("Payment does not match this invoice");
  }

  const intentAmount = Math.round(Number(intent.amount ?? 0)) / 100;
  if (Math.abs(intentAmount - params.chargeAmount) > 0.01) {
    throw new Error("Payment amount does not match the selected total");
  }

  if (intent.status !== "succeeded" && intent.status !== "processing") {
    throw new Error("Payment has not completed yet");
  }

  const shouldSaveCard = Boolean(
    params.invoice.save_card_for_future_charges ||
      params.invoice.auto_charge_remainder,
  );

  let stripeCustomerId = params.invoice.stripe_customer_id ?? null;
  let savedPaymentMethodId: string | null = null;
  let paymentMethodBrand: string | null = null;
  let paymentMethodLast4: string | null = null;

  const customerId =
    typeof intent.customer === "string"
      ? intent.customer
      : intent.customer?.id ?? stripeCustomerId;

  const paymentMethod = intent.payment_method;
  const paymentMethodId =
    typeof paymentMethod === "string" ? paymentMethod : paymentMethod?.id;

  if (customerId && paymentMethodId && shouldSaveCard) {
    stripeCustomerId = customerId;
    const cardInfo = await attachPaymentMethodToCustomer(
      stripe,
      customerId,
      paymentMethodId,
    );
    savedPaymentMethodId = paymentMethodId;
    paymentMethodBrand = cardInfo.brand;
    paymentMethodLast4 = cardInfo.last4;
  } else if (paymentMethod && typeof paymentMethod !== "string") {
    paymentMethodBrand = paymentMethod.card?.brand ?? paymentMethod.type ?? null;
    paymentMethodLast4 = paymentMethod.card?.last4 ?? null;
  }

  const metadataInstallments = parseRemainderInstallmentNumbersFromMetadata(
    metadata,
  );
  const remainderInstallmentNumbers = metadataInstallments.length > 0
    ? metadataInstallments
    : params.remainderInstallmentNumbers;

  return {
    intent,
    stripeCustomerId,
    savedPaymentMethodId,
    paymentMethodBrand,
    paymentMethodLast4,
    remainderInstallmentNumbers,
  };
}

export async function createInvoicePaymentIntent(
  stripe: Stripe,
  params: {
    amountCents: number;
    currency: string;
    customerId: string;
    paymentMethodId: string;
    metadata: {
      type: "client_invoice";
      org_id: string;
      invoice_id: string;
      remainder_installment_numbers?: string;
    };
    idempotencyKey: string;
    saveForFutureUse?: boolean;
  },
) {
  return stripe.paymentIntents.create(
    {
      amount: params.amountCents,
      currency: params.currency.toLowerCase(),
      customer: params.customerId,
      payment_method: params.paymentMethodId,
      confirm: true,
      off_session: false,
      ...walletFriendlyPaymentIntentOptions,
      ...(params.saveForFutureUse
        ? { setup_future_usage: "off_session" as const }
        : {}),
      metadata: { ...params.metadata },
    },
    { idempotencyKey: params.idempotencyKey },
  );
}

export async function createOffSessionInvoicePaymentIntent(
  stripe: Stripe,
  params: {
    amountCents: number;
    currency: string;
    customerId: string;
    paymentMethodId: string;
    metadata: {
      type: "client_invoice";
      org_id: string;
      invoice_id: string;
      remainder_installment_number: string;
      auto_charge: "0" | "1";
      staff_charge?: "1";
    };
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
      ...walletFriendlyPaymentIntentOptions,
      metadata: { ...params.metadata },
    },
    { idempotencyKey: params.idempotencyKey },
  );
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
      ...walletFriendlyPaymentIntentOptions,
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
      ...walletFriendlyPaymentIntentOptions,
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
      metadata: paymentIntent.metadata,
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
