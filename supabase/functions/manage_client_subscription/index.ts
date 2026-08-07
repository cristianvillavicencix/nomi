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
  type BillingInterval,
  type ClientSubscriptionRow,
} from "../_shared/clientSubscriptionStripe.ts";
import { sendSubscriptionSetupDelivery } from "../_shared/clientSubscriptionDelivery.ts";

type ManageBody = {
  subscription_id?: number;
  action?:
    | "pause"
    | "resume"
    | "cancel_now"
    | "cancel_at_period_end"
    | "send_setup";
  send_email?: boolean;
  send_sms?: boolean;
  email_to?: string | null;
  sms_to?: string | null;
  message?: string | null;
  subject?: string | null;
  base_url?: string | null;
};

const loadSubscription = async (orgId: number, subscriptionId: number) => {
  const { data } = await supabaseAdmin
    .from("client_subscriptions")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", subscriptionId)
    .maybeSingle();
  return data as ClientSubscriptionRow | null;
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
          return createErrorResponse(403, "You cannot manage subscriptions");
        }

        if (isStripeMockMode()) {
          return createErrorResponse(
            400,
            "Stripe billing is disabled in this environment",
          );
        }

        const body = (await req.json()) as ManageBody;
        const subscriptionId = Number(body.subscription_id);
        const action = body.action;

        if (!Number.isFinite(subscriptionId)) {
          return createErrorResponse(400, "Invalid subscription_id");
        }
        if (!action) {
          return createErrorResponse(400, "action is required");
        }

        const subscription = await loadSubscription(member.org_id, subscriptionId);
        if (!subscription) {
          return createErrorResponse(404, "Subscription not found");
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

        const stripe = await getStripeForOrg(member.org_id);
        const stripeSubId = subscription.stripe_subscription_id?.trim();
        const stripeCustomerId = subscription.stripe_customer_id?.trim();

        if (action === "send_setup") {
          if (!stripeCustomerId) {
            return createErrorResponse(
              400,
              "Stripe customer is not set up for this subscription",
            );
          }

          const metadata = buildSubscriptionMetadata({
            orgId: member.org_id,
            subscriptionId: subscription.id,
            contactId: subscription.contact_id,
            companyId: subscription.company_id,
          });

          const baseUrl = body.base_url?.trim()?.replace(/\/$/, "") ||
            resolvePublicAppBaseUrl();
          const returnQuery = `tab=subscriptions&subscription=${subscription.id}`;

          const session = await createStripeSubscriptionCheckout(stripe, {
            customerId: stripeCustomerId,
            name: subscription.name,
            amount: Number(subscription.amount),
            currency: subscription.currency,
            billingInterval: subscription.billing_interval as BillingInterval,
            successUrl: `${baseUrl}/billing?${returnQuery}&setup=success`,
            cancelUrl: `${baseUrl}/billing?${returnQuery}&setup=cancel`,
            metadata,
          });

          const checkoutUrl = session.url;
          if (!checkoutUrl) {
            return createErrorResponse(500, "Stripe did not return a checkout URL");
          }

          await supabaseAdmin
            .from("client_subscriptions")
            .update({
              stripe_checkout_session_id: session.id,
              setup_checkout_url: checkoutUrl,
              status: "pending_setup",
              updated_at: new Date().toISOString(),
            })
            .eq("id", subscription.id);

          let recipientEmail = body.email_to?.trim() ?? "";
          if (!recipientEmail && subscription.contact_id) {
            recipientEmail =
              (await resolveContactEmail(
                supabaseAdmin,
                subscription.contact_id,
              )) ?? "";
          }

          const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("name")
            .eq("id", member.org_id)
            .maybeSingle();

          const delivery = await sendSubscriptionSetupDelivery(supabaseAdmin, {
            orgId: member.org_id,
            memberId: Number(member.id),
            orgName: org?.name ?? null,
            subscriptionName: subscription.name,
            checkoutUrl,
            emailTo: recipientEmail,
            smsTo: body.sms_to,
            subject: body.subject,
            message: body.message,
            sendEmail: body.send_email,
            sendSms: body.send_sms,
            contactId: subscription.contact_id,
          });

          const { data: fresh } = await supabaseAdmin
            .from("client_subscriptions")
            .select("*")
            .eq("id", subscription.id)
            .single();

          return new Response(
            JSON.stringify({
              subscription: fresh,
              checkout_url: checkoutUrl,
              ...delivery,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (!stripeSubId) {
          return createErrorResponse(
            400,
            "This subscription is not active in Stripe yet. Send a setup link first.",
          );
        }

        let updatedSub;
        const now = new Date().toISOString();

        switch (action) {
          case "pause":
            updatedSub = await stripe.subscriptions.update(stripeSubId, {
              pause_collection: { behavior: "mark_uncollectible" },
            });
            await applyStripeSubscriptionSnapshot(
              supabaseAdmin,
              subscription.id,
              updatedSub,
            );
            break;
          case "resume":
            updatedSub = await stripe.subscriptions.update(stripeSubId, {
              pause_collection: "",
            });
            await applyStripeSubscriptionSnapshot(
              supabaseAdmin,
              subscription.id,
              updatedSub,
            );
            break;
          case "cancel_at_period_end":
            updatedSub = await stripe.subscriptions.update(stripeSubId, {
              cancel_at_period_end: true,
            });
            await applyStripeSubscriptionSnapshot(
              supabaseAdmin,
              subscription.id,
              updatedSub,
            );
            break;
          case "cancel_now":
            updatedSub = await stripe.subscriptions.cancel(stripeSubId);
            await applyStripeSubscriptionSnapshot(
              supabaseAdmin,
              subscription.id,
              updatedSub,
            );
            await supabaseAdmin
              .from("client_subscriptions")
              .update({ canceled_at: now, status: "canceled" })
              .eq("id", subscription.id);
            break;
          default:
            return createErrorResponse(400, "Unknown action");
        }

        const { data: fresh } = await supabaseAdmin
          .from("client_subscriptions")
          .select("*")
          .eq("id", subscription.id)
          .single();

        return new Response(JSON.stringify({ subscription: fresh }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("manage_client_subscription.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
