import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  amountToCents,
  isStripeMockMode,
  persistInvoiceStripeCheckoutSession,
  resolveContactEmail,
  resolveInvoiceCheckoutPaymentIntent,
  resolveOrCreateInvoiceStripeCustomer,
} from "../_shared/clientProposalBilling.ts";
import {
  buildInvoicePaymentIntentMetadata,
  resolvePublicClientInvoicePayment,
} from "../_shared/publicClientInvoicePaymentContext.ts";
import { getStripe } from "../_shared/stripeClient.ts";

type PrepareBody = {
  public_token?: string;
  amount?: number;
  remainder_installment_numbers?: number[];
  payment_intent_id?: string;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as PrepareBody;

      const resolved = await resolvePublicClientInvoicePayment(
        supabaseAdmin,
        body,
      );
      if (!resolved.ok) {
        return createErrorResponse(resolved.status, resolved.message);
      }

      const { invoice, chargeAmount, remainderInstallmentNumbers } =
        resolved.data;

      if (isStripeMockMode()) {
        return new Response(
          JSON.stringify({
            billing_mode: "mock",
            charge_amount: chargeAmount,
            client_secret: null,
            payment_intent_id: null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const email =
        (await resolveContactEmail(supabaseAdmin, invoice.contact_id)) ??
          invoice.recipient_email?.trim() ??
          null;

      if (!email) {
        return createErrorResponse(
          400,
          "Contact email is required for card payments",
        );
      }

      const { data: contact } = invoice.contact_id
        ? await supabaseAdmin
          .from("contacts")
          .select("first_name, last_name")
          .eq("id", invoice.contact_id)
          .maybeSingle()
        : { data: null };

      const contactName = [contact?.first_name, contact?.last_name]
        .filter(Boolean)
        .join(" ");

      const shouldSaveCard = Boolean(
        invoice.save_card_for_future_charges || invoice.auto_charge_remainder,
      );

      const stripe = getStripe();
      const metadata = buildInvoicePaymentIntentMetadata(
        invoice,
        remainderInstallmentNumbers,
      );
      const amountCents = amountToCents(chargeAmount);

      const candidatePaymentIntentIds = [
        String(body.payment_intent_id ?? "").trim(),
        invoice.stripe_payment_intent_id?.trim() ?? "",
      ];

      const customer = await resolveOrCreateInvoiceStripeCustomer(stripe, {
        email,
        name: contactName || undefined,
        orgId: invoice.org_id,
        contactId: invoice.contact_id,
        companyId: invoice.company_id,
        existingCustomerId: invoice.stripe_customer_id,
        existingPaymentIntentId:
          candidatePaymentIntentIds.find(Boolean) ?? undefined,
      });

      const intent = await resolveInvoiceCheckoutPaymentIntent(stripe, {
        candidatePaymentIntentIds,
        amountCents,
        invoiceId: invoice.id,
        orgId: invoice.org_id,
        metadata,
        createParams: {
          amountCents,
          currency: invoice.currency ?? "usd",
          customerId: customer.id,
          saveForFutureUse: shouldSaveCard,
          metadata,
        },
      });

      await persistInvoiceStripeCheckoutSession(supabaseAdmin, {
        invoiceId: invoice.id,
        orgId: invoice.org_id,
        stripePaymentIntentId: intent.id,
        stripeCustomerId: customer.id,
      });

      return new Response(
        JSON.stringify({
          billing_mode: "stripe",
          charge_amount: chargeAmount,
          client_secret: intent.client_secret,
          payment_intent_id: intent.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("prepare_client_invoice_payment.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
