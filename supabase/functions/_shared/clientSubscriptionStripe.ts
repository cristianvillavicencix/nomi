import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
// @ts-expect-error ESM from esm.sh (Deno)
import type Stripe from "https://esm.sh/stripe@14.25.0?target=deno&no-check";
import {
  amountToCents,
  resolveOrCreateInvoiceStripeCustomer,
} from "./clientProposalBilling.ts";
import { resolveBillingRecipientEmailFromParts } from "./billingRecipientResolution.ts";
import { sendSubscriptionSetupDelivery } from "./clientSubscriptionDelivery.ts";
import { ensureSubscriptionSetupShareLink } from "./clientSubscriptionSetupLink.ts";
import { subscriptionStatementDescriptorSettings } from "./subscriptionStatementDescriptor.ts";
import { resolvePublicAppBaseUrl } from "./publicAppUrl.ts";

export type BillingInterval = "weekly" | "monthly" | "yearly";

export const formatSubscriptionAmountLabel = (
  amount: number,
  currency: string,
  interval: BillingInterval,
) => {
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(Number(amount) || 0);
  if (interval === "weekly") return `${money}/wk`;
  if (interval === "yearly") return `${money}/yr`;
  return `${money}/mo`;
};

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
  setup_share_url?: string | null;
  subscription_number?: string | null;
  starts_at: string | null;
  ends_at: string | null;
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

const parseIsoDateStart = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00`);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseIsoDateEnd = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T23:59:59`);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const buildStripeSubscriptionScheduleParams = (params: {
  startsAt?: string | null;
  endsAt?: string | null;
}) => {
  const now = new Date();
  const startsAt = parseIsoDateStart(params.startsAt) ?? now;
  const endsAt = parseIsoDateEnd(params.endsAt);
  const startMs = startsAt.getTime();
  const trialEnd =
    startMs > now.getTime() + 60_000
      ? Math.floor(startMs / 1000)
      : undefined;
  const cancelAt = endsAt ? Math.floor(endsAt.getTime() / 1000) : undefined;
  return { trial_end: trialEnd, cancel_at: cancelAt };
};

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

export type SubscriptionLineItemInput = {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  package_id?: number | null;
  addon_id?: number | null;
};

export const normalizeSubscriptionLineItems = (
  lineItems: unknown,
  fallbackName: string,
  fallbackAmount: number,
): SubscriptionLineItemInput[] => {
  const raw = Array.isArray(lineItems) ? lineItems : [];
  const normalized = raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      const description = String(record.description ?? "").trim();
      const unitPrice = Number(record.unit_price);
      const quantity = Number(record.quantity) || 1;
      if (!description || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        return null;
      }
      return {
        description,
        quantity,
        unit: String(record.unit ?? "ea"),
        unit_price: unitPrice,
        package_id: record.package_id ?? null,
        addon_id: record.addon_id ?? null,
      } satisfies SubscriptionLineItemInput;
    })
    .filter((line): line is SubscriptionLineItemInput => line != null);

  if (normalized.length > 0) return normalized;

  return [
    {
      description: fallbackName,
      quantity: 1,
      unit: "ea",
      unit_price: fallbackAmount,
    },
  ];
};

export const sumSubscriptionLineItemsAmount = (
  lineItems: SubscriptionLineItemInput[],
) =>
  lineItems.reduce(
    (sum, line) => sum + line.quantity * line.unit_price,
    0,
  );

const buildStripeLineItemPriceData = (
  line: SubscriptionLineItemInput,
  currency: string,
  billingInterval: BillingInterval,
): Stripe.SubscriptionCreateParams.Item.PriceData => ({
  currency: currency.toLowerCase(),
  unit_amount: amountToCents(line.unit_price),
  recurring: {
    interval: mapBillingIntervalToStripe(billingInterval),
  },
  product_data: { name: line.description },
});

export const buildStripeSubscriptionCreateItems = (
  lineItems: SubscriptionLineItemInput[],
  currency: string,
  billingInterval: BillingInterval,
): Stripe.SubscriptionCreateParams.Item[] =>
  lineItems.map((line) => ({
    price_data: buildStripeLineItemPriceData(line, currency, billingInterval),
    quantity: Math.max(1, Math.round(line.quantity)) || 1,
  }));

export const buildStripeCheckoutLineItems = (
  lineItems: SubscriptionLineItemInput[],
  currency: string,
  billingInterval: BillingInterval,
): Stripe.Checkout.SessionCreateParams.LineItem[] =>
  lineItems.map((line) => ({
    quantity: Math.max(1, Math.round(line.quantity)) || 1,
    price_data: buildStripeLineItemPriceData(line, currency, billingInterval),
  }));

const readPaymentMethodFromStripe = (
  paymentMethod: Stripe.PaymentMethod | string | null | undefined,
) => {
  if (!paymentMethod || typeof paymentMethod === "string") {
    return {
      id: typeof paymentMethod === "string" ? paymentMethod : null,
      brand: null as string | null,
      last4: null as string | null,
    };
  }
  return {
    id: paymentMethod.id,
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

  const subscriptionQuery = supabase
    .from("client_subscriptions")
    .select(
      "stripe_customer_id, stripe_payment_method_id, payment_method_brand, payment_method_last4, updated_at",
    )
    .eq("org_id", params.orgId)
    .not("stripe_payment_method_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (params.contactId) {
    subscriptionQuery.eq("contact_id", params.contactId);
  } else if (params.companyId) {
    subscriptionQuery.eq("company_id", params.companyId);
  }

  const { data: subscriptionRow } = await subscriptionQuery.maybeSingle();
  if (
    subscriptionRow?.stripe_customer_id?.trim() &&
    subscriptionRow?.stripe_payment_method_id?.trim()
  ) {
    return {
      stripeCustomerId: subscriptionRow.stripe_customer_id.trim(),
      stripePaymentMethodId: subscriptionRow.stripe_payment_method_id.trim(),
      paymentMethodBrand: subscriptionRow.payment_method_brand ?? null,
      paymentMethodLast4: subscriptionRow.payment_method_last4 ?? null,
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
    startsAt?: string | null;
    endsAt?: string | null;
    lineItems?: SubscriptionLineItemInput[];
  },
) {
  const schedule = buildStripeSubscriptionScheduleParams({
    startsAt: params.startsAt,
    endsAt: params.endsAt,
  });
  const items = buildStripeSubscriptionCreateItems(
    params.lineItems ??
      normalizeSubscriptionLineItems([], params.name, params.amount),
    params.currency,
    params.billingInterval,
  );
  return stripe.subscriptions.create({
    customer: params.customerId,
    default_payment_method: params.paymentMethodId,
    collection_method: "charge_automatically",
    ...subscriptionStatementDescriptorSettings(params.name),
    items,
    metadata: params.metadata,
    ...(schedule.trial_end ? { trial_end: schedule.trial_end } : {}),
    ...(schedule.cancel_at ? { cancel_at: schedule.cancel_at } : {}),
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
    startsAt?: string | null;
    endsAt?: string | null;
    lineItems?: SubscriptionLineItemInput[];
  },
) {
  const schedule = buildStripeSubscriptionScheduleParams({
    startsAt: params.startsAt,
    endsAt: params.endsAt,
  });
  const lineItems = buildStripeCheckoutLineItems(
    params.lineItems ??
      normalizeSubscriptionLineItems([], params.name, params.amount),
    params.currency,
    params.billingInterval,
  );
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    line_items: lineItems,
    metadata: params.metadata,
    subscription_data: {
      metadata: params.metadata,
      ...(schedule.trial_end ? { trial_end: schedule.trial_end } : {}),
      ...(schedule.cancel_at ? { cancel_at: schedule.cancel_at } : {}),
    },
  });
}

export async function updateStripeSubscriptionBilling(
  stripe: Stripe,
  params: {
    stripeSubscriptionId: string;
    name: string;
    amount: number;
    currency: string;
    billingInterval: BillingInterval;
    endsAt?: string | null;
    lineItems?: SubscriptionLineItemInput[];
  },
) {
  const normalizedLines = normalizeSubscriptionLineItems(
    params.lineItems,
    params.name,
    params.amount,
  );
  const stripeSub = await stripe.subscriptions.retrieve(
    params.stripeSubscriptionId,
  );
  const existingItems = stripeSub.items.data;
  if (!existingItems.length && normalizedLines.length === 0) {
    throw new Error("Stripe subscription has no billable item");
  }

  const schedule = buildStripeSubscriptionScheduleParams({
    endsAt: params.endsAt,
  });

  const items: Stripe.SubscriptionUpdateParams.Item[] = [];
  for (let index = normalizedLines.length; index < existingItems.length; index++) {
    items.push({ id: existingItems[index].id, deleted: true });
  }
  normalizedLines.forEach((line, index) => {
    const existingItem = existingItems[index];
    const price_data = buildStripeLineItemPriceData(
      line,
      params.currency,
      params.billingInterval,
    );
    const quantity = Math.max(1, Math.round(line.quantity)) || 1;
    if (existingItem) {
      items.push({ id: existingItem.id, price_data, quantity });
    } else {
      items.push({ price_data, quantity });
    }
  });

  const updateParams: Stripe.SubscriptionUpdateParams = {
    items,
    ...subscriptionStatementDescriptorSettings(params.name),
    proration_behavior: "create_prorations",
  };

  if (schedule.cancel_at) {
    updateParams.cancel_at = schedule.cancel_at;
  } else if (stripeSub.cancel_at) {
    updateParams.cancel_at = null;
  }

  return stripe.subscriptions.update(params.stripeSubscriptionId, updateParams);
}

export async function reactivateStripeSubscription(
  stripe: Stripe,
  supabase: SupabaseClient,
  params: {
    subscription: ClientSubscriptionRow;
    metadata: Record<string, string>;
  },
) {
  const customerId = params.subscription.stripe_customer_id?.trim();
  if (!customerId) {
    throw new Error("Stripe customer is not set up for this subscription");
  }

  const savedPayment = await resolveClientStripePaymentMethod(supabase, {
    orgId: params.subscription.org_id,
    contactId: params.subscription.contact_id,
    companyId: params.subscription.company_id,
  });

  const paymentMethodId = savedPayment?.stripePaymentMethodId?.trim();
  if (!paymentMethodId) {
    throw new Error(
      "No saved payment method found. Send a setup link to collect a card first.",
    );
  }

  const lineItems = normalizeSubscriptionLineItems(
    params.subscription.line_items,
    params.subscription.name,
    Number(params.subscription.amount),
  );

  const stripeSub = await createStripeSubscriptionWithCard(stripe, {
    customerId,
    paymentMethodId,
    name: params.subscription.name,
    amount: Number(params.subscription.amount),
    currency: params.subscription.currency ?? "USD",
    billingInterval: params.subscription.billing_interval,
    metadata: params.metadata,
    startsAt: params.subscription.starts_at,
    endsAt: params.subscription.ends_at,
    lineItems,
  });

  await applyStripeSubscriptionSnapshot(
    supabase,
    params.subscription.id,
    stripeSub,
  );

  await supabase
    .from("client_subscriptions")
    .update({
      canceled_at: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.subscription.id);

  return stripeSub;
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

  const { data: existing } = await supabase
    .from("client_subscriptions")
    .select("activated_at")
    .eq("id", subscriptionId)
    .maybeSingle();

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
    stripe_payment_method_id: pm.id,
    updated_at: now,
  };

  if (status === "active" || status === "trialing") {
    update.setup_checkout_url = null;
    update.stripe_checkout_session_id = null;
    if (!existing?.activated_at) {
      update.activated_at = now;
    }
  }

  if (stripeSub.cancel_at) {
    update.ends_at = new Date(stripeSub.cancel_at * 1000).toISOString();
  }

  await supabase
    .from("client_subscriptions")
    .update(update)
    .eq("id", subscriptionId);
}

const retrieveStripeSubscriptionExpanded = async (
  stripe: Stripe,
  stripeSubscriptionId: string,
) =>
  stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["default_payment_method"],
  });

const subscriptionMatchesSigmaRecord = (
  stripeSub: Stripe.Subscription,
  subscription: ClientSubscriptionRow,
) => {
  const metadataId = Number(stripeSub.metadata?.subscription_id);
  if (
    stripeSub.metadata?.type === CLIENT_SUBSCRIPTION_METADATA_TYPE &&
    metadataId === subscription.id
  ) {
    return true;
  }

  const expectedAmountCents = amountToCents(Number(subscription.amount));
  return stripeSub.items.data.some((item) => {
    const unitAmount = item.price?.unit_amount;
    return unitAmount != null && unitAmount === expectedAmountCents;
  });
};

export async function syncClientSubscriptionFromStripe(
  stripe: Stripe,
  supabase: SupabaseClient,
  subscription: ClientSubscriptionRow,
) {
  const metadata = buildSubscriptionMetadata({
    orgId: subscription.org_id,
    subscriptionId: subscription.id,
    contactId: subscription.contact_id,
    companyId: subscription.company_id,
  });

  const applyAndReturn = async (
    stripeSub: Stripe.Subscription,
    source: string,
  ) => {
    if (
      stripeSub.metadata?.subscription_id !== String(subscription.id) ||
      stripeSub.metadata?.type !== CLIENT_SUBSCRIPTION_METADATA_TYPE
    ) {
      await stripe.subscriptions.update(stripeSub.id, { metadata });
    }
    await applyStripeSubscriptionSnapshot(
      supabase,
      subscription.id,
      stripeSub,
    );
    return { synced: true, source, stripe_subscription_id: stripeSub.id };
  };

  const existingStripeSubId = subscription.stripe_subscription_id?.trim();
  if (existingStripeSubId) {
    const stripeSub = await retrieveStripeSubscriptionExpanded(
      stripe,
      existingStripeSubId,
    );
    return applyAndReturn(stripeSub, "stripe_subscription_id");
  }

  const checkoutSessionId = subscription.stripe_checkout_session_id?.trim();
  if (checkoutSessionId) {
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ["subscription"],
    });
    if (session.mode === "subscription" && session.subscription) {
      const stripeSubId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
      const stripeSub = await retrieveStripeSubscriptionExpanded(
        stripe,
        stripeSubId,
      );
      return applyAndReturn(stripeSub, "checkout_session");
    }
  }

  const customerId = subscription.stripe_customer_id?.trim();
  if (customerId) {
    const list = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
      expand: ["data.default_payment_method"],
    });

    const preferredStatuses = new Set([
      "active",
      "trialing",
      "past_due",
      "unpaid",
    ]);

    const match =
      list.data.find((stripeSub) =>
        subscriptionMatchesSigmaRecord(stripeSub, subscription)
      ) ??
      list.data.find((stripeSub) => preferredStatuses.has(stripeSub.status));

    if (match) {
      return applyAndReturn(match, "customer_subscriptions");
    }
  }

  return { synced: false, reason: "no_stripe_subscription_found" };
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

  await supabase
    .from("client_subscriptions")
    .update({ last_billed_at: paidAt, updated_at: new Date().toISOString() })
    .eq("id", params.subscription.id);

  return { skipped: false, invoice_id: invoice.id };
}

export async function resolveSubscriptionClientName(
  supabase: SupabaseClient,
  params: {
    contactId?: number | null;
    companyId?: number | null;
  },
) {
  if (params.contactId) {
    const { data } = await supabase
      .from("contacts")
      .select("first_name, last_name, company_id")
      .eq("id", params.contactId)
      .maybeSingle();
    if (data) {
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
      return {
        name: name || undefined,
        companyId: params.companyId ?? data.company_id,
      };
    }
  }
  if (params.companyId) {
    const { data } = await supabase
      .from("companies")
      .select("name")
      .eq("id", params.companyId)
      .maybeSingle();
    if (data?.name) {
      return { name: data.name, companyId: params.companyId };
    }
  }
  return { name: undefined, companyId: params.companyId ?? null };
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

export async function resolveSubscriptionBillingEmail(
  supabase: SupabaseClient,
  params: {
    companyId?: number | null;
    contactId?: number | null;
    emailTo?: string | null;
  },
): Promise<string> {
  const explicit = params.emailTo?.trim();
  if (explicit) return explicit;

  let companyContextLinks: string[] | null = null;
  let primaryContactEmails: Array<{ email?: string | null; isPrimary?: boolean }> | null =
    null;
  let businessEmail: string | null = null;

  if (params.companyId) {
    const { data } = await supabase
      .from("companies")
      .select("context_links, primary_contact_email_jsonb, email")
      .eq("id", params.companyId)
      .maybeSingle();
    companyContextLinks = (data?.context_links as string[] | null) ?? null;
    primaryContactEmails =
      (data?.primary_contact_email_jsonb as Array<{
        email?: string | null;
        isPrimary?: boolean;
      }> | null) ?? null;
    businessEmail = data?.email ?? null;
  }

  let contactEmails: Array<{ email?: string | null; isPrimary?: boolean }> | null =
    null;
  if (params.contactId) {
    const { data } = await supabase
      .from("contacts")
      .select("email_jsonb")
      .eq("id", params.contactId)
      .maybeSingle();
    contactEmails =
      (data?.email_jsonb as Array<{
        email?: string | null;
        isPrimary?: boolean;
      }> | null) ?? null;
  }

  return resolveBillingRecipientEmailFromParts({
    companyContextLinks,
    primaryContactEmails,
    businessEmail,
    contactEmails,
  });
}

export async function ensureSubscriptionStripeCustomer(
  stripe: Stripe,
  supabase: SupabaseClient,
  params: {
    orgId: number;
    subscription: ClientSubscriptionRow;
    emailTo?: string | null;
  },
): Promise<string> {
  const existing = params.subscription.stripe_customer_id?.trim();
  if (existing) return existing;

  const contactId = params.subscription.contact_id;
  const companyId = params.subscription.company_id;

  let email = await resolveSubscriptionBillingEmail(supabase, {
    companyId,
    contactId,
    emailTo: params.emailTo,
  });
  if (!email) {
    throw new Error("A valid client email is required to set up billing");
  }

  const clientInfo = await resolveSubscriptionClientName(supabase, {
    contactId,
    companyId,
  });
  const resolvedCompanyId = companyId ?? clientInfo.companyId ?? null;

  const savedPayment = await resolveClientStripePaymentMethod(supabase, {
    orgId: params.orgId,
    contactId,
    companyId: resolvedCompanyId,
  });

  const customer = await resolveSubscriptionStripeCustomer(stripe, supabase, {
    orgId: params.orgId,
    contactId,
    companyId: resolvedCompanyId,
    email,
    name: clientInfo.name,
    savedPayment,
  });

  await supabase
    .from("client_subscriptions")
    .update({
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.subscription.id);

  return customer.id;
}

export type SubscriptionPaymentMode =
  | "saved_card"
  | "staff_card"
  | "request_setup";

export async function applySubscriptionPayment(
  stripe: Stripe,
  supabase: SupabaseClient,
  params: {
    orgId: number;
    memberId: number;
    subscription: ClientSubscriptionRow;
    paymentMode: SubscriptionPaymentMode;
    paymentMethodId?: string | null;
    emailTo?: string | null;
    smsTo?: string | null;
    sendEmail?: boolean;
    sendSms?: boolean;
    message?: string | null;
    subject?: string | null;
    baseUrl?: string | null;
    orgName?: string | null;
  },
) {
  if (params.subscription.status !== "pending_setup") {
    throw new Error("Payment can only be applied while setup is pending");
  }
  if (params.subscription.stripe_subscription_id?.trim()) {
    throw new Error("This subscription is already active in Stripe");
  }

  const stripeCustomerId = await ensureSubscriptionStripeCustomer(
    stripe,
    supabase,
    {
      orgId: params.orgId,
      subscription: params.subscription,
      emailTo: params.emailTo,
    },
  );

  const recipientEmail = await resolveSubscriptionBillingEmail(supabase, {
    companyId: params.subscription.company_id,
    contactId: params.subscription.contact_id,
    emailTo: params.emailTo,
  });

  const savedPayment = await resolveClientStripePaymentMethod(supabase, {
    orgId: params.orgId,
    contactId: params.subscription.contact_id,
    companyId: params.subscription.company_id,
  });

  const metadata = buildSubscriptionMetadata({
    orgId: params.orgId,
    subscriptionId: params.subscription.id,
    contactId: params.subscription.contact_id,
    companyId: params.subscription.company_id,
  });

  const baseUrl = params.baseUrl?.trim()?.replace(/\/$/, "") ||
    resolvePublicAppBaseUrl();
  const returnQuery = `tab=subscriptions&subscription=${params.subscription.id}`;
  const scheduleParams = {
    startsAt: params.subscription.starts_at,
    endsAt: params.subscription.ends_at,
  };

  let checkoutUrl: string | null = null;
  let usedSavedCard = false;
  let usedStaffCard = false;
  let emailSent = false;
  let emailSkipped = false;
  let smsSent = false;
  let smsSkipped = false;

  let paymentMethodId: string | null = null;
  let paymentMethodBrand: string | null = null;
  let paymentMethodLast4: string | null = null;

  if (params.paymentMode === "staff_card") {
    const staffPaymentMethodId = params.paymentMethodId?.trim();
    if (!staffPaymentMethodId) {
      throw new Error(
        "Enter and confirm the client card before activating the subscription",
      );
    }
    await stripe.paymentMethods.attach(staffPaymentMethodId, {
      customer: stripeCustomerId,
    });
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: staffPaymentMethodId,
      },
    });
    const pm = await stripe.paymentMethods.retrieve(staffPaymentMethodId);
    paymentMethodId = staffPaymentMethodId;
    paymentMethodBrand = pm.card?.brand ?? null;
    paymentMethodLast4 = pm.card?.last4 ?? null;
    usedStaffCard = true;
  } else if (params.paymentMode === "saved_card") {
    const explicitPaymentMethodId = params.paymentMethodId?.trim();
    if (explicitPaymentMethodId) {
      const pm = await stripe.paymentMethods.retrieve(explicitPaymentMethodId);
      paymentMethodId = explicitPaymentMethodId;
      paymentMethodBrand = pm.card?.brand ?? null;
      paymentMethodLast4 = pm.card?.last4 ?? null;
      usedSavedCard = true;
    } else if (savedPayment?.stripePaymentMethodId) {
      paymentMethodId = savedPayment.stripePaymentMethodId;
      paymentMethodBrand = savedPayment.paymentMethodBrand;
      paymentMethodLast4 = savedPayment.paymentMethodLast4;
      usedSavedCard = true;
    } else {
      throw new Error(
        "No saved card found for this client. Choose another payment option.",
      );
    }
  }

  if (paymentMethodId) {
    const subscriptionLines = normalizeSubscriptionLineItems(
      params.subscription.line_items,
      params.subscription.name,
      Number(params.subscription.amount),
    );
    const stripeSub = await createStripeSubscriptionWithCard(stripe, {
      customerId: stripeCustomerId,
      paymentMethodId,
      name: params.subscription.name,
      amount: Number(params.subscription.amount),
      currency: params.subscription.currency,
      billingInterval: params.subscription.billing_interval,
      metadata,
      lineItems: subscriptionLines,
      ...scheduleParams,
    });
    await applyStripeSubscriptionSnapshot(
      supabase,
      params.subscription.id,
      stripeSub,
    );
    await supabase
      .from("client_subscriptions")
      .update({
        stripe_customer_id: stripeCustomerId,
        payment_method_brand: paymentMethodBrand,
        payment_method_last4: paymentMethodLast4,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.subscription.id);
  } else {
    const subscriptionLines = normalizeSubscriptionLineItems(
      params.subscription.line_items,
      params.subscription.name,
      Number(params.subscription.amount),
    );
    const session = await createStripeSubscriptionCheckout(stripe, {
      customerId: stripeCustomerId,
      name: params.subscription.name,
      amount: Number(params.subscription.amount),
      currency: params.subscription.currency,
      billingInterval: params.subscription.billing_interval,
      successUrl: `${baseUrl}/billing?${returnQuery}&setup=success`,
      cancelUrl: `${baseUrl}/billing?${returnQuery}&setup=cancel`,
      metadata,
      lineItems: subscriptionLines,
      ...scheduleParams,
    });

    checkoutUrl = session.url ?? null;
    await supabase
      .from("client_subscriptions")
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_checkout_session_id: session.id,
        setup_checkout_url: checkoutUrl,
        status: "pending_setup",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.subscription.id);

    const shouldSendEmail = params.sendEmail === true;
    const shouldSendSms = params.sendSms === true;

    if (checkoutUrl && (shouldSendEmail || shouldSendSms)) {
      const delivery = await deliverSubscriptionSetupLink(supabase, {
        orgId: params.orgId,
        memberId: params.memberId,
        orgName: params.orgName ?? null,
        subscription: params.subscription,
        checkoutUrl,
        baseUrl: params.baseUrl,
        emailTo: recipientEmail,
        smsTo: params.smsTo,
        subject: params.subject,
        message: params.message,
        sendEmail: shouldSendEmail,
        sendSms: shouldSendSms,
      });
      emailSent = delivery.emailSent;
      emailSkipped = delivery.emailSkipped;
      smsSent = delivery.smsSent;
      smsSkipped = delivery.smsSkipped;
    }
  }

  return {
    checkout_url: checkoutUrl,
    used_saved_card: usedSavedCard,
    used_staff_card: usedStaffCard,
    email_sent: emailSent,
    email_skipped: emailSkipped,
    sms_sent: smsSent,
    sms_skipped: smsSkipped,
  };
}

export async function deliverSubscriptionSetupLink(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    memberId: number;
    orgName: string | null;
    subscription: ClientSubscriptionRow;
    checkoutUrl: string;
    baseUrl: string;
    emailTo?: string | null;
    smsTo?: string | null;
    subject?: string | null;
    message?: string | null;
    sendEmail?: boolean;
    sendSms?: boolean;
  },
) {
  const { shareUrl } = await ensureSubscriptionSetupShareLink(supabase, {
    orgId: params.orgId,
    subscriptionId: params.subscription.id,
    checkoutUrl: params.checkoutUrl,
    baseUrl: params.baseUrl,
  });

  return sendSubscriptionSetupDelivery(supabase, {
    orgId: params.orgId,
    memberId: params.memberId,
    orgName: params.orgName,
    subscriptionName: params.subscription.name,
    subscriptionNumber: params.subscription.subscription_number ?? null,
    amountLabel: formatSubscriptionAmountLabel(
      Number(params.subscription.amount),
      params.subscription.currency,
      params.subscription.billing_interval,
    ),
    shareUrl,
    emailTo: params.emailTo,
    smsTo: params.smsTo,
    subject: params.subject,
    message: params.message,
    sendEmail: params.sendEmail,
    sendSms: params.sendSms,
    contactId: params.subscription.contact_id,
  });
}
