import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  amountToCents,
  attachPaymentMethodToCustomer,
  isStripeMockMode,
  resolveContactEmail,
  resolveOrCreateInvoiceStripeCustomer,
} from "../_shared/clientProposalBilling.ts";
import { getStripe } from "../_shared/stripeClient.ts";

type PayBody = {
  public_token?: string;
  payment_method_id?: string;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as PayBody;
      const token = String(body.public_token ?? "").trim();
      const paymentMethodId = String(body.payment_method_id ?? "").trim();

      if (!token) {
        return createErrorResponse(400, "Missing public_token");
      }

      const { data: tokenRow } = await supabaseAdmin
        .from("public_client_invoice_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (!tokenRow) {
        return createErrorResponse(403, "Invalid or expired link");
      }

      if (
        tokenRow.expires_at &&
        new Date(tokenRow.expires_at).getTime() < Date.now()
      ) {
        return createErrorResponse(410, "This invoice link has expired");
      }

      const { data: invoice } = await supabaseAdmin
        .from("client_invoices")
        .select(
          "id, org_id, contact_id, company_id, amount, amount_paid, currency, status, upfront_percent, save_card_for_future_charges, auto_charge_remainder, stripe_payment_intent_id, recipient_email",
        )
        .eq("id", tokenRow.invoice_id)
        .eq("org_id", tokenRow.org_id)
        .maybeSingle();

      if (!invoice?.id) {
        return createErrorResponse(404, "Invoice not found");
      }

      if (invoice.status === "void" || invoice.status === "paid") {
        return new Response(
          JSON.stringify({
            invoice_id: invoice.id,
            status: invoice.status,
            already_paid: invoice.status === "paid",
            amount_paid: invoice.amount_paid,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const total = Number(invoice.amount) || 0;
      const paid = Number(invoice.amount_paid) || 0;
      const balance = Math.max(Math.round((total - paid) * 100) / 100, 0);
      if (balance <= 0) {
        return new Response(
          JSON.stringify({
            invoice_id: invoice.id,
            status: "paid",
            already_paid: true,
            amount_paid: paid,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const upfrontPercent = Number(invoice.upfront_percent ?? 100);
      const targetUpfront =
        Math.round(total * (Math.min(Math.max(upfrontPercent, 1), 100) / 100) * 100) /
        100;
      const chargeAmount = Math.min(
        Math.max(Math.round((targetUpfront - paid) * 100) / 100, 0),
        balance,
      ) || balance;

      const mock = isStripeMockMode();
      const now = new Date().toISOString();
      let paymentIntentId: string | null = invoice.stripe_payment_intent_id ?? null;

      if (!mock) {
        if (!paymentMethodId) {
          return createErrorResponse(400, "payment_method_id is required");
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

        const stripe = getStripe();
        const customer = await resolveOrCreateInvoiceStripeCustomer(stripe, {
          email,
          name: contactName || undefined,
          orgId: invoice.org_id,
          contactId: invoice.contact_id,
          companyId: invoice.company_id,
          existingPaymentIntentId: invoice.stripe_payment_intent_id,
        });

        await attachPaymentMethodToCustomer(
          stripe,
          customer.id,
          paymentMethodId,
        );

        const intent = await stripe.paymentIntents.create({
          amount: amountToCents(chargeAmount),
          currency: (invoice.currency ?? "usd").toLowerCase(),
          customer: customer.id,
          payment_method: paymentMethodId,
          confirm: true,
          off_session: false,
          metadata: {
            type: "client_invoice",
            org_id: String(invoice.org_id),
            invoice_id: String(invoice.id),
          },
        });

        if (intent.status !== "succeeded" && intent.status !== "processing") {
          return createErrorResponse(400, "Payment could not be completed");
        }
        paymentIntentId = intent.id;

        if (invoice.save_card_for_future_charges) {
          await stripe.customers.update(customer.id, {
            invoice_settings: { default_payment_method: paymentMethodId },
          });
        }
      }

      const newPaid = Math.round((paid + chargeAmount) * 100) / 100;
      const isPaidInFull = newPaid >= total - 0.01;
      const nextStatus = isPaidInFull ? "paid" : "sent";

      const { data: updated } = await supabaseAdmin
        .from("client_invoices")
        .update({
          amount_paid: newPaid,
          status: nextStatus,
          paid_at: isPaidInFull ? now : null,
          sent_at: invoice.status === "draft" ? now : undefined,
          stripe_payment_intent_id: paymentIntentId,
          updated_at: now,
        })
        .eq("id", invoice.id)
        .select("*")
        .single();

      return new Response(
        JSON.stringify({
          invoice: updated,
          charged_amount: chargeAmount,
          amount_paid: newPaid,
          balance_due: Math.max(Math.round((total - newPaid) * 100) / 100, 0),
          paid_in_full: isPaidInFull,
          billing_mode: mock ? "mock" : "stripe",
          auto_charge_scheduled:
            Boolean(invoice.auto_charge_remainder) &&
            Boolean(invoice.save_card_for_future_charges) &&
            !isPaidInFull,
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
