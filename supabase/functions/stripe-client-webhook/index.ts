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
import { createErrorResponse } from "../_shared/utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

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
