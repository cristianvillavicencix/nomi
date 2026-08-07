import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
// @ts-expect-error ESM from esm.sh (Deno)
import type Stripe from "https://esm.sh/stripe@14.25.0?target=deno&no-check";
import {
  amountToCents,
  resolveOrCreateInvoiceStripeCustomer,
} from "./clientProposalBilling.ts";

export type BillingInterval = "weekly" | "monthly" | "yearly";

export type ClientSubscriptionRow = {
  id: number;
  org_id: number;
  company_id: number | null;
  contact_id: number | null;
  deal_id: number | null;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  billing_interval: BillingInterval;
  line_items: unknown;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_checkout_session_id: string | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_at: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  paused_at: string | null;
  setup_checkout_url: string | null;
};

export type SavedClientPaymentMethod = {
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
};

export const CLIENT_SUBSCRIPTION_METADATA_TYPE = "client_subscription";

export const mapBillingIntervalToStripe = (
  interval: BillingInterval,
): Stripe.Price.Recurring.Interval => {
  if (interval === "weekly") return "week";
  if (interval === "yearly") return "year";
  return "month";
};

export const buildSubscriptionMetadata = (params: {
  orgId: number;
  subscriptionId: number;
  contactId?: number | null;
  companyId?: number | null;
}) => ({
  type: CLIENT_SUBSCRIPTION_METADATA_TYPE,
  org_id: String(params.orgId),
  subscription_id: String(params.subscriptionId),
  contact_id: params.contactId ? String(params.contactId) : "",
  company_id: params.companyId ? String(params.companyId) : "",
});

export const buildSubscriptionPriceData = (params: {
  name: string;
  amount: number;
  currency: string;
  billingInterval: BillingInterval;
}): Stripe.Checkout.SessionCreateParams.LineItem.PriceData => ({
  currency: params.currency.toLowerCase(),
  unit_amount: amountToCents(params.amount),
  recurring: {
    interval: mapBillingIntervalToStripe(params.billingInterval),
  },
  product_data: {
    name: params.name,
  },
});

const readPaymentMethodFromStripe = (
  paymentMethod: Stripe.PaymentMethod | string | null | undefined,
) => {
  if (!paymentMethod || typeof paymentMethod === "string") {
    return { brand: null as string | null, last4: null as string | null };
  }
  return {
    brand: paymentMethod.card?.brand ?? null,
    last4: paymentMethod.card?.last4 ?? null,
  };
};

export async function resolveClientStripePaymentMethod(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    contactId?: number | null;
    companyId?: number | null;
  },
): Promise<SavedClientPaymentMethod | null> {
  const invoiceQuery = supabase
    .from("client_invoices")
    .select(
      "stripe_customer_id, stripe_payment_method_id, payment_method_brand, payment_method_last4, updated_at",
    )
    .eq("org_id", params.orgId)
    .not("stripe_payment_method_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (params.contactId) {
    invoiceQuery.eq("contact_id", params.contactId);
  } else if (params.companyId) {
    invoiceQuery.eq("company_id", params.companyId);
  } else {
    return null;
  }

  const { data: invoiceRow } = await invoiceQuery.maybeSingle();
  if (
    invoiceRow?.stripe_customer_id?.trim() &&
    invoiceRow?.stripe_payment_method_id?.trim()
  ) {
    return {
      stripeCustomerId: invoiceRow.stripe_customer_id.trim(),
      stripePaymentMethodId: invoiceRow.stripe_payment_method_id.trim(),
      paymentMethodBrand: invoiceRow.payment_method_brand ?? null,
      paymentMethodLast4: invoiceRow.payment_method_last4 ?? null,
    };
  }

  const contractQuery = supabase
    .from("contracts")
    .select(
      "stripe_customer_id, stripe_payment_method_id, payment_method_brand, payment_method_last4, updated_at",
    )
    .eq("org_id", params.orgId)
    .not("stripe_payment_method_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (params.contactId) {
    contractQuery.eq("contact_id", params.contactId);
  } else if (params.companyId) {
    contractQuery.eq("company_id", params.companyId);
  }

  const { data: contractRow } = await contractQuery.maybeSingle();
  if (
    contractRow?.stripe_customer_id?.trim() &&
    contractRow?.stripe_payment_method_id?.trim()
  ) {
    return {
      stripeCustomerId: contractRow.stripe_customer_id.trim(),
      stripePaymentMethodId: contractRow.stripe_payment_method_id.trim(),
      paymentMethodBrand: contractRow.payment_method_brand ?? null,
      paymentMethodLast4: contractRow.payment_method_last4 ?? null,
    };
  }

  return null;
}

export async function createStripeSubscriptionWithCard(
  stripe: Stripe,
  params: {
    customerId: string;
    paymentMethodId: string;
    name: string;
    amount: number;
    currency: string;
    billingInterval: BillingInterval;
    metadata: Record<string, string>;
  },
) {
  return stripe.subscriptions.create({
    customer: params.customerId,
    default_payment_method: params.paymentMethodId,
    collection_method: "charge_automatically",
    items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: amountToCents(params.amount),
          recurring: {
            interval: mapBillingIntervalToStripe(params.billingInterval),
          },
          product_data: { name: params.name },
        },
      },
    ],
    metadata: params.metadata,
    expand: ["default_payment_method", "latest_invoice.payment_intent"],
  });
}

export async function createStripeSubscriptionCheckout(
  stripe: Stripe,
  params: {
    customerId: string;
    name: string;
    amount: number;
    currency: string;
    billingInterval: BillingInterval;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  },
) {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    line_items: [
      {
        quantity: 1,
        price_data: buildSubscriptionPriceData({
          name: params.name,
          amount: params.amount,
          currency: params.currency,
          billingInterval: params.billingInterval,
        }),
      },
    ],
    metadata: params.metadata,
    subscription_data: {
      metadata: params.metadata,
    },
  });
}

export const mapStripeSubscriptionStatus = (
  stripeStatus: string,
  paused: boolean,
): ClientSubscriptionRow["status"] => {
  if (paused) return "paused";
  switch (stripeStatus) {
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "trialing":
      return "trialing";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "paused":
      return "pending_setup";
    default:
      return "pending_setup";
  }
};

export async function applyStripeSubscriptionSnapshot(
  supabase: SupabaseClient,
  subscriptionId: number,
  stripeSub: Stripe.Subscription,
) {
  const paused = Boolean(stripeSub.pause_collection);
  const status = mapStripeSubscriptionStatus(stripeSub.status, paused);
  const pm = readPaymentMethodFromStripe(stripeSub.default_payment_method);
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    stripe_subscription_id: stripeSub.id,
    stripe_customer_id:
      typeof stripeSub.customer === "string"
        ? stripeSub.customer
        : stripeSub.customer?.id ?? null,
    status,
    current_period_start: stripeSub.current_period_start
      ? new Date(stripeSub.current_period_start * 1000).toISOString()
      : null,
    current_period_end: stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000).toISOString()
      : null,
    next_billing_at: stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
    canceled_at: stripeSub.canceled_at
      ? new Date(stripeSub.canceled_at * 1000).toISOString()
      : null,
    paused_at: paused ? now : null,
    payment_method_brand: pm.brand,
    payment_method_last4: pm.last4,
    updated_at: now,
  };

  if (status === "active" || status === "trialing") {
    update.setup_checkout_url = null;
    update.stripe_checkout_session_id = null;
  }

  await supabase
    .from("client_subscriptions")
    .update(update)
    .eq("id", subscriptionId);
}

export async function mirrorSubscriptionInvoiceToSigma(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    subscription: ClientSubscriptionRow;
    stripeInvoice: Stripe.Invoice;
  },
) {
  const stripeInvoiceId = params.stripeInvoice.id;
  if (!stripeInvoiceId) return { skipped: true, reason: "missing_invoice_id" };

  const { data: existing } = await supabase
    .from("client_invoices")
    .select("id")
    .eq("org_id", params.orgId)
    .eq("stripe_subscription_invoice_id", stripeInvoiceId)
    .maybeSingle();

  if (existing?.id) {
    return { skipped: true, reason: "already_mirrored", invoice_id: existing.id };
  }

  const amountPaid = (params.stripeInvoice.amount_paid ?? 0) / 100;
  if (amountPaid <= 0) {
    return { skipped: true, reason: "zero_amount" };
  }

  const { data: invoiceNumber, error: numberError } = await supabase.rpc(
    "next_client_invoice_number",
    { p_org_id: params.orgId },
  );
  if (numberError || !invoiceNumber) {
    throw new Error("Could not generate invoice number");
  }

  const today = new Date().toISOString().slice(0, 10);
  const paidAt = params.stripeInvoice.status_transitions?.paid_at
    ? new Date(params.stripeInvoice.status_transitions.paid_at * 1000)
        .toISOString()
    : new Date().toISOString();

  const { data: invoice, error: insertError } = await supabase
    .from("client_invoices")
    .insert({
      org_id: params.orgId,
      invoice_number: invoiceNumber as string,
      company_id: params.subscription.company_id,
      contact_id: params.subscription.contact_id,
      deal_id: params.subscription.deal_id,
      subscription_id: params.subscription.id,
      stripe_subscription_invoice_id: stripeInvoiceId,
      issue_date: today,
      due_date: today,
      amount: amountPaid,
      subtotal: amountPaid,
      currency: (params.subscription.currency ?? "USD").toUpperCase(),
      description: `${params.subscription.name} — subscription charge`,
      status: "paid",
      paid_at: paidAt,
      sent_at: paidAt,
      amount_paid: amountPaid,
      stripe_customer_id: params.subscription.stripe_customer_id,
      payment_method_brand: params.subscription.payment_method_brand,
      payment_method_last4: params.subscription.payment_method_last4,
    })
    .select("id")
    .single();

  if (insertError || !invoice) {
    throw new Error(insertError?.message ?? "Could not mirror subscription invoice");
  }

  const lineItems = Array.isArray(params.subscription.line_items)
    ? (params.subscription.line_items as Array<Record<string, unknown>>)
    : [];

  if (lineItems.length > 0) {
    await supabase.from("client_invoice_line_items").insert(
      lineItems.map((line, index) => {
        const quantity = Number(line.quantity) || 1;
        const unitPrice = Number(line.unit_price) || amountPaid;
        return {
          org_id: params.orgId,
          invoice_id: invoice.id,
          description: String(line.description ?? params.subscription.name),
          quantity,
          unit: String(line.unit ?? "ea"),
          unit_price: unitPrice,
          line_total: Math.round(quantity * unitPrice * 100) / 100,
          package_id: line.package_id ?? null,
          addon_id: line.addon_id ?? null,
          sort_order: index,
        };
      }),
    );
  } else {
    await supabase.from("client_invoice_line_items").insert({
      org_id: params.orgId,
      invoice_id: invoice.id,
      description: params.subscription.name,
      quantity: 1,
      unit: "ea",
      unit_price: amountPaid,
      line_total: amountPaid,
      sort_order: 0,
    });
  }

  return { skipped: false, invoice_id: invoice.id };
}

export async function resolveSubscriptionStripeCustomer(
  stripe: Stripe,
  supabase: SupabaseClient,
  params: {
    orgId: number;
    contactId?: number | null;
    companyId?: number | null;
    email: string;
    name?: string;
    savedPayment?: SavedClientPaymentMethod | null;
  },
) {
  const savedCustomerId = params.savedPayment?.stripeCustomerId?.trim();
  return resolveOrCreateInvoiceStripeCustomer(stripe, {
    email: params.email,
    name: params.name,
    orgId: params.orgId,
    contactId: params.contactId,
    companyId: params.companyId,
    existingCustomerId: savedCustomerId ?? null,
  });
}
