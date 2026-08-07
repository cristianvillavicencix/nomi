import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import {
  isStripeMockMode,
  resolveContactEmail,
} from "../_shared/clientProposalBilling.ts";
import { getStripeForOrg } from "../_shared/stripeClient.ts";
import { isOrgClientInvoiceCheckoutEnabled } from "../_shared/organizationStripeSettings.ts";
import { resolvePublicAppBaseUrl } from "../_shared/publicAppUrl.ts";
import {
  applyStripeSubscriptionSnapshot,
  buildSubscriptionMetadata,
  createStripeSubscriptionCheckout,
  createStripeSubscriptionWithCard,
  resolveClientStripePaymentMethod,
  resolveSubscriptionStripeCustomer,
  type BillingInterval,
} from "../_shared/clientSubscriptionStripe.ts";
import { sendSubscriptionSetupDelivery } from "../_shared/clientSubscriptionDelivery.ts";

type CreateBody = {
  company_id?: number | null;
  contact_id?: number | null;
  deal_id?: number | null;
  name?: string;
  description?: string | null;
  amount?: number;
  currency?: string;
  billing_interval?: BillingInterval;
  line_items?: Array<Record<string, unknown>>;
  starts_at?: string | null;
  ends_at?: string | null;
  payment_mode?: "saved_card" | "staff_card" | "request_setup";
  payment_method_id?: string | null;
  send_email?: boolean;
  send_sms?: boolean;
  email_to?: string | null;
  sms_to?: string | null;
  message?: string | null;
  subject?: string | null;
  base_url?: string | null;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resolveClientName = async (params: {
  contactId?: number | null;
  companyId?: number | null;
}) => {
  if (params.contactId) {
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("first_name, last_name, company_id")
      .eq("id", params.contactId)
      .maybeSingle();
    if (data) {
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
      return { name: name || undefined, companyId: params.companyId ?? data.company_id };
    }
  }
  if (params.companyId) {
    const { data } = await supabaseAdmin
      .from("companies")
      .select("name")
      .eq("id", params.companyId)
      .maybeSingle();
    if (data?.name) return { name: data.name, companyId: params.companyId };
  }
  return { name: undefined, companyId: params.companyId ?? null };
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      try {
        const member = await getUserOrganizationMember(user);
        if (!member?.id) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (
          !member.administrator &&
          !hasMemberCapability(member, "proposals.send")
        ) {
          return createErrorResponse(403, "You cannot create subscriptions");
        }

        if (isStripeMockMode()) {
          return createErrorResponse(
            400,
            "Stripe billing is disabled in this environment",
          );
        }

        const cardPaymentsLive = await isOrgClientInvoiceCheckoutEnabled(
          member.org_id,
        );
        if (!cardPaymentsLive) {
          return createErrorResponse(
            403,
            "Card payments are turned off. Enable them under Settings → Integrations → Stripe.",
          );
        }

        const body = (await req.json()) as CreateBody;
        const companyId = body.company_id ? Number(body.company_id) : null;
        const contactId = body.contact_id ? Number(body.contact_id) : null;
        const dealId = body.deal_id ? Number(body.deal_id) : null;
        const name = body.name?.trim();
        const amount = Number(body.amount);
        const billingInterval = body.billing_interval ?? "monthly";

        if (!companyId && !contactId) {
          return createErrorResponse(400, "Select a client to bill");
        }
        if (!name) {
          return createErrorResponse(400, "Subscription name is required");
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          return createErrorResponse(400, "Amount must be greater than zero");
        }
        if (!["weekly", "monthly", "yearly"].includes(billingInterval)) {
          return createErrorResponse(400, "Invalid billing interval");
        }

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("name")
          .eq("id", member.org_id)
          .maybeSingle();

        const clientInfo = await resolveClientName({ contactId, companyId });
        const resolvedCompanyId = companyId ?? clientInfo.companyId ?? null;

        let recipientEmail = body.email_to?.trim() ?? "";
        if (!recipientEmail && contactId) {
          recipientEmail = (await resolveContactEmail(supabaseAdmin, contactId)) ?? "";
        }
        if (!recipientEmail || !emailRegex.test(recipientEmail)) {
          return createErrorResponse(
            400,
            "A valid client email is required to set up billing",
          );
        }

        const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
        const startsAt = body.starts_at?.trim() || null;
        const endsAt = body.ends_at?.trim() || null;
        const paymentMode =
          body.payment_mode ??
          (body.payment_method_id?.trim()
            ? "staff_card"
            : "request_setup");

        const { data: subscription, error: insertError } = await supabaseAdmin
          .from("client_subscriptions")
          .insert({
            org_id: member.org_id,
            company_id: resolvedCompanyId,
            contact_id: contactId,
            deal_id: dealId,
            name,
            description: body.description?.trim() || null,
            amount,
            currency: (body.currency ?? "USD").toUpperCase(),
            billing_interval: billingInterval,
            line_items: lineItems,
            starts_at: startsAt,
            ends_at: endsAt,
            status: "pending_setup",
            created_by_member_id: member.id,
          })
          .select("*")
          .single();

        if (insertError || !subscription) {
          return createErrorResponse(
            500,
            insertError?.message ?? "Could not create subscription",
          );
        }

        const stripe = await getStripeForOrg(member.org_id);
        const savedPayment = await resolveClientStripePaymentMethod(
          supabaseAdmin,
          {
            orgId: member.org_id,
            contactId,
            companyId: resolvedCompanyId,
          },
        );

        const customer = await resolveSubscriptionStripeCustomer(
          stripe,
          supabaseAdmin,
          {
            orgId: member.org_id,
            contactId,
            companyId: resolvedCompanyId,
            email: recipientEmail,
            name: clientInfo.name,
            savedPayment,
          },
        );

        const metadata = buildSubscriptionMetadata({
          orgId: member.org_id,
          subscriptionId: subscription.id,
          contactId,
          companyId: resolvedCompanyId,
        });

        const baseUrl = body.base_url?.trim()?.replace(/\/$/, "") ||
          resolvePublicAppBaseUrl();
        const returnQuery = `tab=subscriptions&subscription=${subscription.id}`;

        let checkoutUrl: string | null = null;
        let usedSavedCard = false;
        let usedStaffCard = false;
        let emailSent = false;
        let emailSkipped = false;
        let smsSent = false;
        let smsSkipped = false;

        const scheduleParams = { startsAt, endsAt };

        let paymentMethodId: string | null = null;
        let paymentMethodBrand: string | null = null;
        let paymentMethodLast4: string | null = null;

        if (paymentMode === "staff_card") {
          const staffPaymentMethodId = body.payment_method_id?.trim();
          if (!staffPaymentMethodId) {
            return createErrorResponse(
              400,
              "Enter and confirm the client card before creating the subscription",
            );
          }
          await stripe.paymentMethods.attach(staffPaymentMethodId, {
            customer: customer.id,
          });
          await stripe.customers.update(customer.id, {
            invoice_settings: {
              default_payment_method: staffPaymentMethodId,
            },
          });
          const pm = await stripe.paymentMethods.retrieve(staffPaymentMethodId);
          paymentMethodId = staffPaymentMethodId;
          paymentMethodBrand = pm.card?.brand ?? null;
          paymentMethodLast4 = pm.card?.last4 ?? null;
          usedStaffCard = true;
        } else if (paymentMode === "saved_card") {
          if (!savedPayment?.stripePaymentMethodId) {
            return createErrorResponse(
              400,
              "No saved card found for this client. Choose another payment option.",
            );
          }
          paymentMethodId = savedPayment.stripePaymentMethodId;
          paymentMethodBrand = savedPayment.paymentMethodBrand;
          paymentMethodLast4 = savedPayment.paymentMethodLast4;
          usedSavedCard = true;
        }

        if (paymentMethodId) {
          const stripeSub = await createStripeSubscriptionWithCard(stripe, {
            customerId: customer.id,
            paymentMethodId,
            name,
            amount,
            currency: subscription.currency,
            billingInterval,
            metadata,
            ...scheduleParams,
          });
          await applyStripeSubscriptionSnapshot(
            supabaseAdmin,
            subscription.id,
            stripeSub,
          );
          await supabaseAdmin
            .from("client_subscriptions")
            .update({
              stripe_customer_id: customer.id,
              payment_method_brand: paymentMethodBrand,
              payment_method_last4: paymentMethodLast4,
            })
            .eq("id", subscription.id);
        } else {
          const session = await createStripeSubscriptionCheckout(stripe, {
            customerId: customer.id,
            name,
            amount,
            currency: subscription.currency,
            billingInterval,
            successUrl: `${baseUrl}/billing?${returnQuery}&setup=success`,
            cancelUrl: `${baseUrl}/billing?${returnQuery}&setup=cancel`,
            metadata,
            ...scheduleParams,
          });

          checkoutUrl = session.url ?? null;
          await supabaseAdmin
            .from("client_subscriptions")
            .update({
              stripe_customer_id: customer.id,
              stripe_checkout_session_id: session.id,
              setup_checkout_url: checkoutUrl,
            })
            .eq("id", subscription.id);

          const shouldSendEmail = body.send_email !== false;
          const shouldSendSms = body.send_sms === true;

          if (checkoutUrl && (shouldSendEmail || shouldSendSms)) {
            const delivery = await sendSubscriptionSetupDelivery(supabaseAdmin, {
              orgId: member.org_id,
              memberId: Number(member.id),
              orgName: org?.name ?? null,
              subscriptionName: name,
              checkoutUrl,
              emailTo: recipientEmail,
              smsTo: body.sms_to,
              subject: body.subject,
              message: body.message,
              sendEmail: shouldSendEmail,
              sendSms: shouldSendSms,
              contactId,
            });
            emailSent = delivery.emailSent;
            emailSkipped = delivery.emailSkipped;
            smsSent = delivery.smsSent;
            smsSkipped = delivery.smsSkipped;
          }
        }

        const { data: fresh } = await supabaseAdmin
          .from("client_subscriptions")
          .select("*")
          .eq("id", subscription.id)
          .single();

        return new Response(
          JSON.stringify({
            subscription: fresh,
            checkout_url: checkoutUrl,
            used_saved_card: usedSavedCard,
            used_staff_card: usedStaffCard,
            email_sent: emailSent,
            email_skipped: emailSkipped,
            sms_sent: smsSent,
            sms_skipped: smsSkipped,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        console.error("create_client_subscription.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
