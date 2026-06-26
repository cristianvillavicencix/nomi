import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  amountToCents,
  attachPaymentMethodToCustomer,
  createInvoicePaymentIntent,
  finalizeInvoicePaymentFromIntent,
  isStripeMockMode,
  resolveContactEmail,
  resolveOrCreateInvoiceStripeCustomer,
} from "../_shared/clientProposalBilling.ts";
import { applyClientInvoicePaymentUpdate } from "../_shared/clientInvoicePayment.ts";
import {
  buildInvoicePaymentIntentMetadata,
  resolvePublicClientInvoicePayment,
} from "../_shared/publicClientInvoicePaymentContext.ts";
import { notifyInvoicePaymentReceipt } from "../_shared/invoicePaymentEmails.ts";
import { getStripe } from "../_shared/stripeClient.ts";

type PayBody = {
  public_token?: string;
  payment_method_id?: string;
  payment_intent_id?: string;
  amount?: number;
  remainder_installment_numbers?: number[];
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as PayBody;
      const paymentMethodId = String(body.payment_method_id ?? "").trim();
      const completedPaymentIntentId = String(
        body.payment_intent_id ?? "",
      ).trim();

      const resolved = await resolvePublicClientInvoicePayment(
        supabaseAdmin,
        body,
      );
      if (!resolved.ok) {
        if (resolved.status === 409) {
          const token = String(body.public_token ?? "").trim();
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
            if (invoice) {
              return new Response(
                JSON.stringify({
                  invoice_id: invoice.id,
                  status: invoice.status,
                  already_paid: invoice.status === "paid",
                  amount_paid: invoice.amount_paid,
                }),
                {
                  headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                  },
                },
              );
            }
          }
        }
        return createErrorResponse(resolved.status, resolved.message);
      }

      const { invoice, chargeAmount, remainderInstallmentNumbers } =
        resolved.data;

      const mock = isStripeMockMode();
      let paymentIntentId: string | null =
        invoice.stripe_payment_intent_id ?? null;
      let stripeCustomerId: string | null = invoice.stripe_customer_id ?? null;
      let savedPaymentMethodId: string | null =
        invoice.stripe_payment_method_id ?? null;
      let paymentMethodBrand: string | null = null;
      let paymentMethodLast4: string | null = null;
      let paidInstallmentNumbers = remainderInstallmentNumbers;

      if (!mock) {
        const stripe = getStripe();

        if (completedPaymentIntentId) {
          const finalized = await finalizeInvoicePaymentFromIntent(stripe, {
            paymentIntentId: completedPaymentIntentId,
            invoice,
            chargeAmount,
            remainderInstallmentNumbers,
          });
          paymentIntentId = finalized.intent.id;
          stripeCustomerId = finalized.stripeCustomerId;
          savedPaymentMethodId = finalized.savedPaymentMethodId;
          paymentMethodBrand = finalized.paymentMethodBrand;
          paymentMethodLast4 = finalized.paymentMethodLast4;
          paidInstallmentNumbers = finalized.remainderInstallmentNumbers;
        } else {
          if (!paymentMethodId) {
            return createErrorResponse(
              400,
              "payment_method_id or payment_intent_id is required",
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
            invoice.save_card_for_future_charges ||
              invoice.auto_charge_remainder,
          );

          const customer = await resolveOrCreateInvoiceStripeCustomer(stripe, {
            email,
            name: contactName || undefined,
            orgId: invoice.org_id,
            contactId: invoice.contact_id,
            companyId: invoice.company_id,
            existingCustomerId: invoice.stripe_customer_id,
            existingPaymentIntentId: invoice.stripe_payment_intent_id,
          });
          stripeCustomerId = customer.id;

          const cardInfo = await attachPaymentMethodToCustomer(
            stripe,
            customer.id,
            paymentMethodId,
          );
          paymentMethodBrand = cardInfo.brand;
          paymentMethodLast4 = cardInfo.last4;
          if (shouldSaveCard) {
            savedPaymentMethodId = paymentMethodId;
          }

          const intent = await createInvoicePaymentIntent(stripe, {
            amountCents: amountToCents(chargeAmount),
            currency: invoice.currency ?? "usd",
            customerId: customer.id,
            paymentMethodId,
            saveForFutureUse: shouldSaveCard,
            idempotencyKey: `client-invoice-${invoice.id}-${amountToCents(chargeAmount)}-${remainderInstallmentNumbers.join(",") || "checkout"}`,
            metadata: buildInvoicePaymentIntentMetadata(
              invoice,
              remainderInstallmentNumbers,
            ),
          });

          if (intent.status === "requires_action") {
            return new Response(
              JSON.stringify({
                invoice_id: invoice.id,
                billing_mode: "stripe",
                requires_action: true,
                client_secret: intent.client_secret,
                payment_intent_id: intent.id,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          if (intent.status !== "succeeded" && intent.status !== "processing") {
            return createErrorResponse(400, "Payment could not be completed");
          }
          paymentIntentId = intent.id;
        }
      }

      const result = await applyClientInvoicePaymentUpdate(supabaseAdmin, {
        invoice,
        chargeAmount,
        stripePaymentIntentId:
          paymentIntentId ?? `mock-${invoice.id}-${Date.now()}`,
        newlyPaidInstallmentNumbers: paidInstallmentNumbers,
        stripeCustomerId,
        stripePaymentMethodId: savedPaymentMethodId,
        paymentMethodBrand,
        paymentMethodLast4,
        clearAutoChargeError: true,
      });

      const chargedAmount = result.charged_amount ?? chargeAmount;
      let receipt: Awaited<
        ReturnType<typeof notifyInvoicePaymentReceipt>
      > | null = null;
      if (paymentIntentId && !mock) {
        receipt = await notifyInvoicePaymentReceipt(supabaseAdmin, {
          orgId: invoice.org_id,
          invoiceId: invoice.id,
          stripePaymentIntentId: paymentIntentId,
          chargedAmount,
        });
        if (!receipt.sent) {
          console.warn("pay_client_invoice.receipt", receipt);
        }
      }

      return new Response(
        JSON.stringify({
          invoice: result.invoice,
          charged_amount: chargedAmount,
          amount_paid: result.amount_paid ?? invoice.amount_paid,
          balance_due: result.balance_due,
          paid_in_full: result.paid_in_full,
          billing_mode: mock ? "mock" : "stripe",
          receipt_sent: receipt?.sent ?? false,
          receipt_skipped_reason: receipt?.sent
            ? null
            : (receipt?.reason ?? null),
          receipt_error: receipt?.sent ? null : (receipt?.error ?? null),
          auto_charge_scheduled:
            Boolean(invoice.auto_charge_remainder) &&
            Boolean(invoice.save_card_for_future_charges) &&
            !result.paid_in_full,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("pay_client_invoice.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
