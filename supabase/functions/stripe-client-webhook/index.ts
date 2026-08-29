import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/** Client payment webhooks — signing secret from Settings → Integrations → Stripe or env. */
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  getClientWebhookSecret,
  getStripeForWebhookVerification,
} from "../_shared/stripeClient.ts";
import {
  isClientPaymentMetadata,
  processPaymentIntentFailed,
  processPaymentIntentSucceeded,
} from "../_shared/clientProposalBilling.ts";
import {
  applyStripeSubscriptionSnapshot,
  CLIENT_SUBSCRIPTION_METADATA_TYPE,
  mirrorSubscriptionInvoiceToSigma,
  persistSetupCheckoutPaymentMethod,
  type ClientSubscriptionRow,
} from "../_shared/clientSubscriptionStripe.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Stripe Invoice.subscription, expanded object, or Basil parent.subscription_details. */
export const stripeSubscriptionIdFromInvoice = (
  invoice: Record<string, unknown>,
): string | null => {
  const direct = invoice.subscription;
  if (typeof direct === "string" && direct) return direct;
  if (direct && typeof direct === "object") {
    const id = (direct as { id?: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  const parent = invoice.parent;
  if (parent && typeof parent === "object") {
    const nested = (
      parent as {
        subscription_details?: { subscription?: unknown };
      }
    ).subscription_details?.subscription;
    if (typeof nested === "string" && nested) return nested;
  }
  return null;
};

const loadSubscriptionByStripeId = async (stripeSubscriptionId: string) => {
  const { data } = await supabaseAdmin
    .from("client_subscriptions")
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  return data as ClientSubscriptionRow | null;
};

const loadSubscriptionById = async (subscriptionId: number) => {
  const { data } = await supabaseAdmin
    .from("client_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();
  return data as ClientSubscriptionRow | null;
};

const resolveSubscriptionIdFromMetadata = (
  metadata?: Record<string, string> | null,
) => {
  if (metadata?.type !== CLIENT_SUBSCRIPTION_METADATA_TYPE) return null;
  const id = Number(metadata.subscription_id);
  return Number.isFinite(id) ? id : null;
};

const handleClientSubscriptionWebhook = async (
  stripe: Awaited<ReturnType<typeof getStripeForWebhookVerification>>,
  event: { type: string; data: { object: Record<string, unknown> } },
) => {
  const object = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const sessionPartial = object as {
        id?: string;
        mode?: string;
        subscription?: string | null;
        metadata?: Record<string, string> | null;
      };

      let subscriptionId = resolveSubscriptionIdFromMetadata(
        sessionPartial.metadata,
      );
      if (!subscriptionId && sessionPartial.id) {
        const { data: bySession } = await supabaseAdmin
          .from("client_subscriptions")
          .select("id")
          .eq("stripe_checkout_session_id", sessionPartial.id)
          .maybeSingle();
        subscriptionId = bySession?.id ?? null;
      }

      if (sessionPartial.mode === "setup") {
        if (!subscriptionId || !sessionPartial.id) {
          return { handled: false };
        }
        const { data: row } = await supabaseAdmin
          .from("client_subscriptions")
          .select("*")
          .eq("id", subscriptionId)
          .maybeSingle();
        if (!row) return { handled: false };

        const fullSession = await stripe.checkout.sessions.retrieve(
          sessionPartial.id,
          { expand: ["setup_intent", "setup_intent.payment_method"] },
        );
        const saved = await persistSetupCheckoutPaymentMethod(
          stripe,
          supabaseAdmin,
          {
            subscription: row as ClientSubscriptionRow,
            session: fullSession,
          },
        );
        return {
          handled: true,
          subscription_id: subscriptionId,
          setup_card_saved: saved.saved,
        };
      }

      if (sessionPartial.mode !== "subscription") {
        return { handled: false };
      }

      if (!subscriptionId || !sessionPartial.subscription) {
        return { handled: false };
      }

      const stripeSub = await stripe.subscriptions.retrieve(
        sessionPartial.subscription as string,
        { expand: ["default_payment_method"] },
      );
      await applyStripeSubscriptionSnapshot(
        supabaseAdmin,
        subscriptionId,
        stripeSub,
      );
      return { handled: true, subscription_id: subscriptionId };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subPartial = object as {
        id: string;
        metadata?: Record<string, string> | null;
      };
      let subscription =
        (await loadSubscriptionByStripeId(subPartial.id)) ??
        (resolveSubscriptionIdFromMetadata(subPartial.metadata)
          ? await loadSubscriptionById(
              resolveSubscriptionIdFromMetadata(subPartial.metadata)!,
            )
          : null);

      if (!subscription) {
        const customerId =
          typeof (object as { customer?: string | null }).customer === "string"
            ? (object as { customer?: string | null }).customer
            : null;
        if (customerId) {
          const { data: pending } = await supabaseAdmin
            .from("client_subscriptions")
            .select("*")
            .eq("stripe_customer_id", customerId)
            .eq("status", "pending_setup")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          subscription = (pending as ClientSubscriptionRow | null) ?? null;
        }
      }

      if (!subscription) {
        return { handled: false };
      }

      const stripeSub = await stripe.subscriptions.retrieve(subPartial.id, {
        expand: ["default_payment_method"],
      });
      await applyStripeSubscriptionSnapshot(
        supabaseAdmin,
        subscription.id,
        stripeSub,
      );
      return { handled: true, subscription_id: subscription.id };
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = object as Record<string, unknown>;
      const stripeSubId = stripeSubscriptionIdFromInvoice(invoice);
      if (!stripeSubId) {
        return { handled: false };
      }

      const subscription = await loadSubscriptionByStripeId(stripeSubId);
      if (!subscription) {
        return { handled: false };
      }

      if (event.type === "invoice.payment_failed") {
        await supabaseAdmin
          .from("client_subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);
        return { handled: true, subscription_id: subscription.id, past_due: true };
      }

      const invoiceId = typeof invoice.id === "string" ? invoice.id : null;
      if (!invoiceId) {
        return { handled: false };
      }
      const fullInvoice = await stripe.invoices.retrieve(invoiceId);
      const mirror = await mirrorSubscriptionInvoiceToSigma(supabaseAdmin, {
        orgId: subscription.org_id,
        subscription,
        stripeInvoice: fullInvoice,
      });
      return {
        handled: true,
        subscription_id: subscription.id,
        ...mirror,
      };
    }

    default:
      return { handled: false };
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method not allowed");
  }

  let stripe: Awaited<ReturnType<typeof getStripeForWebhookVerification>>;
  let wh: string;
  try {
    [stripe, wh] = await Promise.all([
      getStripeForWebhookVerification(),
      getClientWebhookSecret(),
    ]);
  } catch (e) {
    return createErrorResponse(500, (e as Error).message);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return createErrorResponse(400, "Missing stripe-signature");
  }

  const body = await req.text();

  let event: {
    type: string;
    data: { object: Record<string, unknown> };
  };

  try {
    event = (await stripe.webhooks.constructEventAsync(
      body,
      signature,
      wh,
    )) as typeof event;
  } catch (e) {
    return createErrorResponse(400, (e as Error).message);
  }

  // Valid signature: always 200 so Stripe does not disable the endpoint.
  // Emails / ticket delivery can exceed Stripe's ~20s timeout ("other errors").
  const work = processVerifiedEvent(stripe, event).catch((error) => {
    console.error("stripe-client-webhook.error", error);
    return {
      error: error instanceof Error ? error.message : "Unexpected error",
    };
  });

  const waitUntil = (
    globalThis as {
      EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
    }
  ).EdgeRuntime?.waitUntil;
  if (typeof waitUntil === "function") {
    waitUntil(work);
    return jsonResponse({ received: true });
  }

  const result = await work;
  return jsonResponse({ received: true, ...result });
});

async function processVerifiedEvent(
  stripe: Awaited<ReturnType<typeof getStripeForWebhookVerification>>,
  event: {
    type: string;
    data: { object: Record<string, unknown> };
  },
) {
  const subscriptionResult = await handleClientSubscriptionWebhook(
    stripe,
    event,
  );
  if (subscriptionResult.handled) {
    return subscriptionResult;
  }

  const object = event.data.object as {
    id: string;
    metadata?: Record<string, string> | null;
    amount?: number;
    status?: string;
    last_payment_error?: {
      code?: string;
      message?: string;
      decline_code?: string;
    } | null;
  };

  const metadata = object.metadata ?? undefined;
  const isInvoicePayment = metadata?.type === "client_invoice";
  const isProposalPayment = isClientPaymentMetadata(metadata);

  if (!isInvoicePayment && !isProposalPayment) {
    return { ignored: true };
  }

  switch (event.type) {
    case "payment_intent.succeeded":
      return processPaymentIntentSucceeded(supabaseAdmin, {
        id: object.id,
        amount: object.amount,
        metadata: object.metadata ?? null,
      });
    case "payment_intent.payment_failed":
      return processPaymentIntentFailed(supabaseAdmin, {
        id: object.id,
        amount: object.amount ?? 0,
        metadata: object.metadata ?? null,
        last_payment_error: object.last_payment_error ?? null,
        status: object.status,
      });
    default:
      return {};
  }
}
