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
  type ClientSubscriptionRow,
} from "../_shared/clientSubscriptionStripe.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

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
      const session = object as {
        mode?: string;
        subscription?: string | null;
        metadata?: Record<string, string> | null;
      };
      if (session.mode !== "subscription") {
        return { handled: false };
      }

      const subscriptionId = resolveSubscriptionIdFromMetadata(session.metadata);
      if (!subscriptionId || !session.subscription) {
        return { handled: false };
      }

      const stripeSub = await stripe.subscriptions.retrieve(
        session.subscription as string,
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
      const invoice = object as {
        id?: string;
        subscription?: string | null;
        metadata?: Record<string, string> | null;
      };
      const stripeSubId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : null;
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

      const fullInvoice = await stripe.invoices.retrieve(invoice.id as string);
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
    event = stripe.webhooks.constructEvent(body, signature, wh) as typeof event;
  } catch (e) {
    return createErrorResponse(400, (e as Error).message);
  }

  try {
    const subscriptionResult = await handleClientSubscriptionWebhook(
      stripe,
      event,
    );
    if (subscriptionResult.handled) {
      return new Response(
        JSON.stringify({ received: true, ...subscriptionResult }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const result = await processPaymentIntentSucceeded(supabaseAdmin, {
          id: object.id,
          amount: object.amount,
          metadata: object.metadata ?? null,
        });
        return new Response(JSON.stringify({ received: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "payment_intent.payment_failed": {
        const result = await processPaymentIntentFailed(supabaseAdmin, {
          id: object.id,
          amount: object.amount ?? 0,
          metadata: object.metadata ?? null,
          last_payment_error: object.last_payment_error ?? null,
          status: object.status,
        });
        return new Response(JSON.stringify({ received: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      default:
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("stripe-client-webhook.error", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unexpected error",
    );
  }
});
