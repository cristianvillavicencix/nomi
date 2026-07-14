import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  amountToCents,
  buildInvoiceCheckoutIdempotencyKey,
  isInvoicePaymentAlreadyCompletedError,
  isStripeMockMode,
  listSucceededClientInvoicePaymentIntents,
  persistInvoiceStripeCheckoutSession,
  reconcileStuckClientInvoiceFromStripe,
  resolveContactEmail,
  resolveInvoiceCheckoutPaymentIntent,
  resolveOrCreateInvoiceStripeCustomer,
} from "../_shared/clientProposalBilling.ts";
import {
  buildInvoicePaymentIntentMetadata,
  resolvePublicClientInvoicePayment,
} from "../_shared/publicClientInvoicePaymentContext.ts";
import { getStripeForOrg } from "../_shared/stripeClient.ts";
import {
  isOrgClientInvoiceCheckoutEnabled,
  resolveOrgStripePublishableKey,
} from "../_shared/organizationStripeSettings.ts";

type PrepareBody = {
  public_token?: string;
  amount?: number;
  remainder_installment_numbers?: number[];
  payment_intent_id?: string;
};

const alreadyPaidResponse = (invoice: {
  id: number;
  status: string;
  amount_paid?: number | null;
}) =>
  new Response(
    JSON.stringify({
      invoice_id: invoice.id,
      status: invoice.status,
      already_paid: true,
      amount_paid: invoice.amount_paid,
      message: "This invoice is already paid",
    }),
    {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );

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
        if (resolved.status === 409) {
          const token = String(body.public_token ?? "").trim();
          if (token) {
            const { data: tokenRow } = await supabaseAdmin
              .from("public_client_invoice_tokens")
              .select("invoice_id")
              .eq("token", token)
              .maybeSingle();
            if (tokenRow?.invoice_id) {
              const { data: invoice } = await supabaseAdmin
                .from("client_invoices")
                .select("id, status, amount_paid")
                .eq("id", tokenRow.invoice_id)
                .maybeSingle();
              if (invoice) return alreadyPaidResponse(invoice);
            }
          }
        }
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

      const cardPaymentsLive = await isOrgClientInvoiceCheckoutEnabled(
        invoice.org_id,
      );
      if (!cardPaymentsLive) {
        return new Response(
          JSON.stringify({
            billing_mode: "manual",
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

      const stripe = await getStripeForOrg(invoice.org_id);
      const metadata = buildInvoicePaymentIntentMetadata(
        invoice,
        remainderInstallmentNumbers,
      );
      const amountCents = amountToCents(chargeAmount);

      const candidatePaymentIntentIds = [
        String(body.payment_intent_id ?? "").trim(),
        invoice.stripe_payment_intent_id?.trim() ?? "",
      ];

      // If Stripe already captured payment for this invoice, sync CRM and stop
      // creating another PaymentIntent (prevents duplicate charges on retry).
      const succeededIntents = await listSucceededClientInvoicePaymentIntents(
        stripe,
        {
          orgId: invoice.org_id,
          invoiceId: invoice.id,
          storedPaymentIntentId:
            candidatePaymentIntentIds.find(Boolean) ?? undefined,
        },
      );

      if (succeededIntents.length > 0) {
        await reconcileStuckClientInvoiceFromStripe(supabaseAdmin, stripe, {
          id: invoice.id,
          org_id: invoice.org_id,
          amount: Number(invoice.amount) || 0,
          amount_paid: Number(invoice.amount_paid) || 0,
          status: String(invoice.status),
          stripe_payment_intent_id: invoice.stripe_payment_intent_id,
        });

        const { data: refreshed } = await supabaseAdmin
          .from("client_invoices")
          .select("id, status, amount, amount_paid")
          .eq("id", invoice.id)
          .eq("org_id", invoice.org_id)
          .maybeSingle();

        const total = Number(refreshed?.amount ?? invoice.amount) || 0;
        const paid = Number(refreshed?.amount_paid ?? invoice.amount_paid) || 0;
        if (
          refreshed?.status === "paid" ||
          paid >= total - 0.01
        ) {
          return alreadyPaidResponse(
            refreshed ?? {
              id: invoice.id,
              status: "paid",
              amount_paid: paid,
            },
          );
        }
      }

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

      let intent;
      try {
        intent = await resolveInvoiceCheckoutPaymentIntent(stripe, {
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
            idempotencyKey: buildInvoiceCheckoutIdempotencyKey({
              invoiceId: invoice.id,
              amountCents,
              remainderInstallmentNumbers,
            }),
          },
        });
      } catch (error) {
        if (isInvoicePaymentAlreadyCompletedError(error)) {
          await reconcileStuckClientInvoiceFromStripe(supabaseAdmin, stripe, {
            id: invoice.id,
            org_id: invoice.org_id,
            amount: Number(invoice.amount) || 0,
            amount_paid: Number(invoice.amount_paid) || 0,
            status: String(invoice.status),
            stripe_payment_intent_id:
              error.paymentIntentId || invoice.stripe_payment_intent_id,
          });
          const { data: refreshed } = await supabaseAdmin
            .from("client_invoices")
            .select("id, status, amount_paid")
            .eq("id", invoice.id)
            .maybeSingle();
          return alreadyPaidResponse(
            refreshed ?? {
              id: invoice.id,
              status: "paid",
              amount_paid: invoice.amount_paid,
            },
          );
        }
        throw error;
      }

      // Idempotency can return a previously succeeded intent — never expose it
      // as a new checkout session.
      if (intent.status === "succeeded" || intent.status === "processing") {
        await reconcileStuckClientInvoiceFromStripe(supabaseAdmin, stripe, {
          id: invoice.id,
          org_id: invoice.org_id,
          amount: Number(invoice.amount) || 0,
          amount_paid: Number(invoice.amount_paid) || 0,
          status: String(invoice.status),
          stripe_payment_intent_id: intent.id,
        });
        const { data: refreshed } = await supabaseAdmin
          .from("client_invoices")
          .select("id, status, amount_paid")
          .eq("id", invoice.id)
          .maybeSingle();
        return alreadyPaidResponse(
          refreshed ?? {
            id: invoice.id,
            status: "paid",
            amount_paid: invoice.amount_paid,
          },
        );
      }

      await persistInvoiceStripeCheckoutSession(supabaseAdmin, {
        invoiceId: invoice.id,
        orgId: invoice.org_id,
        stripePaymentIntentId: intent.id,
        stripeCustomerId: customer.id,
      });

      const publishableKey = await resolveOrgStripePublishableKey(
        invoice.org_id,
      );

      return new Response(
        JSON.stringify({
          billing_mode: "stripe",
          charge_amount: chargeAmount,
          client_secret: intent.client_secret,
          payment_intent_id: intent.id,
          stripe_publishable_key: publishableKey,
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
