import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import {
  isStripeMockMode,
} from "../_shared/clientProposalBilling.ts";
import { getStripeForOrg } from "../_shared/stripeClient.ts";
import { isOrgClientInvoiceCheckoutEnabled } from "../_shared/organizationStripeSettings.ts";
import { resolveClientAppBaseUrl } from "../_shared/publicAppUrl.ts";
import {
  applyStripeSubscriptionSnapshot,
  applySubscriptionPayment,
  buildSubscriptionMetadata,
  createStripeSubscriptionSetupCheckout,
  deliverSubscriptionAgreementLink,
  deliverSubscriptionSetupLink,
  ensureSubscriptionStripeCustomer,
  normalizeSubscriptionLineItems,
  reactivateStripeSubscription,
  resolveSubscriptionBillingEmail,
  setClientSubscriptionPaymentMethod,
  listClientSubscriptionPaymentMethods,
  detachClientSubscriptionPaymentMethod,
  sumSubscriptionLineItemsAmount,
  updateStripeSubscriptionBilling,
  type BillingInterval,
  syncClientSubscriptionFromStripe,
  type ClientSubscriptionRow,
  type SubscriptionPaymentMode,
} from "../_shared/clientSubscriptionStripe.ts";

type ManageBody = {
  subscription_id?: number;
  action?:
    | "pause"
    | "resume"
    | "cancel_now"
    | "cancel_at_period_end"
    | "undo_cancel"
    | "reactivate"
    | "send_setup"
    | "send_agreement"
    | "send_completion"
    | "request_card_update"
    | "update_payment_method"
    | "list_payment_methods"
    | "detach_payment_method"
    | "update"
    | "apply_payment"
    | "sync_stripe";
  name?: string | null;
  description?: string | null;
  amount?: number | null;
  billing_interval?: BillingInterval | null;
  ends_at?: string | null;
  reference_number?: string | null;
  deal_id?: number | null;
  line_items?: Array<Record<string, unknown>>;
  payment_mode?: SubscriptionPaymentMode | null;
  payment_method_id?: string | null;
  send_email?: boolean;
  send_sms?: boolean;
  email_to?: string | null;
  sms_to?: string | null;
  message?: string | null;
  subject?: string | null;
  base_url?: string | null;
  /** Days until Stripe auto-resumes a pause. Null/omit = until manual resume. */
  pause_days?: number | null;
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

        if (action === "sync_stripe") {
          const syncResult = await syncClientSubscriptionFromStripe(
            stripe,
            supabaseAdmin,
            subscription,
          );
          const { data: fresh } = await supabaseAdmin
            .from("client_subscriptions")
            .select("*")
            .eq("id", subscription.id)
            .single();

          return new Response(
            JSON.stringify({
              subscription: fresh,
              ...syncResult,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (action === "send_agreement") {
          if ((subscription.enrollment_mode ?? "direct") !== "agreement") {
            return createErrorResponse(
              400,
              "This subscription is not an agreement enrollment",
            );
          }
          if (subscription.status === "canceled") {
            return createErrorResponse(
              400,
              "Cannot resend agreement on a canceled subscription",
            );
          }

          await ensureSubscriptionStripeCustomer(
            stripe,
            supabaseAdmin,
            {
              orgId: member.org_id,
              subscription,
              emailTo: body.email_to,
            },
          );

          const baseUrl = resolveClientAppBaseUrl(body.base_url);
          let recipientEmail = await resolveSubscriptionBillingEmail(
            supabaseAdmin,
            {
              companyId: subscription.company_id,
              contactId: subscription.contact_id,
              emailTo: body.email_to,
            },
          );

          const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("name")
            .eq("id", member.org_id)
            .maybeSingle();

          let clientLabel: string | null = null;
          if (subscription.contact_id) {
            const { data: contactRow } = await supabaseAdmin
              .from("contacts")
              .select("first_name, last_name")
              .eq("id", subscription.contact_id)
              .maybeSingle();
            clientLabel = [contactRow?.first_name, contactRow?.last_name]
              .filter(Boolean)
              .join(" ")
              .trim() || null;
          }
          if (!clientLabel && subscription.company_id) {
            const { data: companyRow } = await supabaseAdmin
              .from("companies")
              .select("name")
              .eq("id", subscription.company_id)
              .maybeSingle();
            clientLabel = companyRow?.name?.trim() || null;
          }

          const delivery = await deliverSubscriptionAgreementLink(
            supabaseAdmin,
            {
              orgId: member.org_id,
              memberId: Number(member.id),
              orgName: org?.name ?? null,
              subscription,
              baseUrl,
              emailTo: recipientEmail,
              smsTo: body.sms_to,
              subject: body.subject,
              message: body.message,
              sendEmail: body.send_email,
              sendSms: body.send_sms,
              clientName: clientLabel,
            },
          );

          const { data: fresh } = await supabaseAdmin
            .from("client_subscriptions")
            .select("*")
            .eq("id", subscription.id)
            .single();

          return new Response(
            JSON.stringify({
              subscription: fresh,
              agreement_share_url: fresh?.setup_share_url ?? null,
              ...delivery,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (action === "send_completion") {
          if ((subscription.enrollment_mode ?? "direct") !== "agreement") {
            return createErrorResponse(
              400,
              "This subscription is not an agreement enrollment",
            );
          }
          if (!subscription.agreement_signed_at) {
            return createErrorResponse(
              400,
              "Agreement must be signed before sending completion docs",
            );
          }

          const { sendSubscriptionAgreementCompletionEmail } = await import(
            "../_shared/subscriptionAgreementCompletion.ts"
          );
          const result = await sendSubscriptionAgreementCompletionEmail(
            supabaseAdmin,
            subscription,
            { force: true },
          );

          const { data: freshCompletion } = await supabaseAdmin
            .from("client_subscriptions")
            .select("*")
            .eq("id", subscription.id)
            .single();

          return new Response(
            JSON.stringify({
              subscription: freshCompletion,
              ...result,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (action === "send_setup" || action === "request_card_update") {
          const isCardUpdate = action === "request_card_update";
          if (
            isCardUpdate &&
            (subscription.status === "canceled" ||
              subscription.status === "pending_setup")
          ) {
            return createErrorResponse(
              400,
              subscription.status === "pending_setup"
                ? "Use Finish setup to collect the first card for this subscription"
                : "Cannot update the card on a canceled subscription",
            );
          }

          const stripeCustomerId = await ensureSubscriptionStripeCustomer(
            stripe,
            supabaseAdmin,
            {
              orgId: member.org_id,
              subscription,
              emailTo: body.email_to,
            },
          );

          const metadata = buildSubscriptionMetadata({
            orgId: member.org_id,
            subscriptionId: subscription.id,
            contactId: subscription.contact_id,
            companyId: subscription.company_id,
          });

          const baseUrl = resolveClientAppBaseUrl(body.base_url);
          const returnQuery = `tab=subscriptions&subscription=${subscription.id}`;

          const session = await createStripeSubscriptionSetupCheckout(stripe, {
            customerId: stripeCustomerId,
            successUrl: `${baseUrl}/billing?${returnQuery}&setup=success`,
            cancelUrl: `${baseUrl}/billing?${returnQuery}&setup=cancel`,
            metadata,
          });

          const checkoutUrl = session.url;
          if (!checkoutUrl) {
            return createErrorResponse(500, "Stripe did not return a checkout URL");
          }

          const checkoutPatch: Record<string, unknown> = {
            stripe_checkout_session_id: session.id,
            setup_checkout_url: checkoutUrl,
            updated_at: new Date().toISOString(),
          };
          // First-time setup only — never demote an active/paused/past_due sub.
          if (!isCardUpdate) {
            checkoutPatch.status = "pending_setup";
          }

          await supabaseAdmin
            .from("client_subscriptions")
            .update(checkoutPatch)
            .eq("id", subscription.id);

          let recipientEmail = await resolveSubscriptionBillingEmail(
            supabaseAdmin,
            {
              companyId: subscription.company_id,
              contactId: subscription.contact_id,
              emailTo: body.email_to,
            },
          );

          const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("name")
            .eq("id", member.org_id)
            .maybeSingle();

          const delivery = await deliverSubscriptionSetupLink(supabaseAdmin, {
            orgId: member.org_id,
            memberId: Number(member.id),
            orgName: org?.name ?? null,
            subscription,
            checkoutUrl,
            baseUrl,
            emailTo: recipientEmail,
            smsTo: body.sms_to,
            subject: body.subject,
            message: body.message,
            sendEmail: body.send_email,
            sendSms: body.send_sms,
            kind: isCardUpdate ? "card_update" : "setup",
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

        if (action === "update_payment_method") {
          const paymentMethodId = body.payment_method_id?.trim();
          if (!paymentMethodId) {
            return createErrorResponse(400, "payment_method_id is required");
          }
          if (
            subscription.status === "canceled" ||
            subscription.status === "pending_setup"
          ) {
            return createErrorResponse(
              400,
              subscription.status === "pending_setup"
                ? "Finish setup before changing the billing card"
                : "Cannot update the card on a canceled subscription",
            );
          }

          const result = await setClientSubscriptionPaymentMethod(
            stripe,
            supabaseAdmin,
            {
              subscription,
              paymentMethodId,
            },
          );

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (action === "list_payment_methods") {
          const result = await listClientSubscriptionPaymentMethods(
            stripe,
            subscription,
          );
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (action === "detach_payment_method") {
          const paymentMethodId = body.payment_method_id?.trim();
          if (!paymentMethodId) {
            return createErrorResponse(400, "payment_method_id is required");
          }
          const result = await detachClientSubscriptionPaymentMethod(
            stripe,
            supabaseAdmin,
            {
              subscription,
              paymentMethodId,
            },
          );
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (action === "apply_payment") {
          if (subscription.status !== "pending_setup") {
            return createErrorResponse(
              400,
              "Payment can only be applied while setup is pending",
            );
          }
          if (subscription.stripe_subscription_id?.trim()) {
            return createErrorResponse(
              400,
              "This subscription is already active in Stripe",
            );
          }

          const paymentMode = body.payment_mode ?? "request_setup";
          if (
            paymentMode !== "saved_card" &&
            paymentMode !== "staff_card" &&
            paymentMode !== "request_setup"
          ) {
            return createErrorResponse(400, "Invalid payment mode");
          }

          const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("name")
            .eq("id", member.org_id)
            .maybeSingle();

          const baseUrl = resolveClientAppBaseUrl(body.base_url);

          const paymentResult = await applySubscriptionPayment(
            stripe,
            supabaseAdmin,
            {
              orgId: member.org_id,
              memberId: Number(member.id),
              subscription,
              paymentMode,
              paymentMethodId: body.payment_method_id,
              emailTo: body.email_to,
              smsTo: body.sms_to,
              sendEmail: body.send_email,
              sendSms: body.send_sms,
              message: body.message,
              subject: body.subject,
              baseUrl,
              orgName: org?.name ?? null,
            },
          );

          const { data: fresh } = await supabaseAdmin
            .from("client_subscriptions")
            .select("*")
            .eq("id", subscription.id)
            .single();

          return new Response(
            JSON.stringify({
              subscription: fresh,
              ...paymentResult,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (action === "update") {
          if (subscription.status === "canceled") {
            return createErrorResponse(
              400,
              "Canceled subscriptions cannot be edited",
            );
          }

          const name = body.name?.trim() || subscription.name;
          const amount =
            body.amount != null ? Number(body.amount) : Number(subscription.amount);
          const billingInterval =
            body.billing_interval ?? subscription.billing_interval;
          const description =
            body.description !== undefined
              ? body.description?.trim() || null
              : subscription.description;

          if (!name) {
            return createErrorResponse(400, "Subscription name is required");
          }
          if (!Number.isFinite(amount) || amount <= 0) {
            return createErrorResponse(400, "Enter a valid amount");
          }
          if (
            billingInterval !== "weekly" &&
            billingInterval !== "monthly" &&
            billingInterval !== "yearly"
          ) {
            return createErrorResponse(400, "Invalid billing interval");
          }

          const endsAt =
            body.ends_at !== undefined
              ? body.ends_at?.trim() || null
              : subscription.ends_at;
          const referenceNumber =
            body.reference_number !== undefined
              ? body.reference_number?.trim() || null
              : subscription.reference_number;
          const dealId =
            body.deal_id !== undefined
              ? body.deal_id
                ? Number(body.deal_id)
                : null
              : subscription.deal_id;
          const lineItemsInput =
            body.line_items !== undefined
              ? body.line_items
              : subscription.line_items;
          const normalizedLines = normalizeSubscriptionLineItems(
            lineItemsInput,
            name,
            amount,
          );
          const computedAmount = sumSubscriptionLineItemsAmount(normalizedLines);
          if (
            body.line_items !== undefined &&
            Math.round(computedAmount * 100) !== Math.round(amount * 100)
          ) {
            return createErrorResponse(
              400,
              "Subscription amount must match the sum of line items",
            );
          }
          const resolvedAmount = body.line_items !== undefined
            ? computedAmount
            : amount;

          const billingChanged =
            Math.round(resolvedAmount * 100) !==
              Math.round(Number(subscription.amount) * 100) ||
            billingInterval !== subscription.billing_interval ||
            (body.line_items !== undefined &&
              JSON.stringify(normalizedLines) !==
                JSON.stringify(
                  normalizeSubscriptionLineItems(
                    subscription.line_items,
                    subscription.name,
                    Number(subscription.amount),
                  ),
                ));

          const dbPatch: Record<string, unknown> = {
            name,
            description,
            amount: resolvedAmount,
            billing_interval: billingInterval,
            ends_at: endsAt,
            reference_number: referenceNumber,
            deal_id: dealId,
            line_items: normalizedLines,
            updated_at: new Date().toISOString(),
          };

          if (
            subscription.status === "pending_setup" &&
            billingChanged
          ) {
            dbPatch.setup_checkout_url = null;
            dbPatch.stripe_checkout_session_id = null;
          }

          await supabaseAdmin
            .from("client_subscriptions")
            .update(dbPatch)
            .eq("id", subscription.id);

          if (stripeSubId) {
            const updatedSub = await updateStripeSubscriptionBilling(stripe, {
              stripeSubscriptionId: stripeSubId,
              name,
              amount: resolvedAmount,
              currency: subscription.currency ?? "USD",
              billingInterval: billingInterval as BillingInterval,
              endsAt,
              lineItems: normalizedLines,
            });
            await applyStripeSubscriptionSnapshot(
              supabaseAdmin,
              subscription.id,
              updatedSub,
            );
            await supabaseAdmin
              .from("client_subscriptions")
              .update({
                name,
                description,
                amount: resolvedAmount,
                billing_interval: billingInterval,
                ends_at: endsAt,
                line_items: normalizedLines,
                updated_at: new Date().toISOString(),
              })
              .eq("id", subscription.id);
          }

          const { data: fresh } = await supabaseAdmin
            .from("client_subscriptions")
            .select("*")
            .eq("id", subscription.id)
            .single();

          return new Response(
            JSON.stringify({
              subscription: fresh,
              setup_link_stale:
                subscription.status === "pending_setup" && billingChanged,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (action === "reactivate") {
          if (subscription.status !== "canceled") {
            return createErrorResponse(
              400,
              "Only canceled subscriptions can be reactivated",
            );
          }
          await reactivateStripeSubscription(stripe, supabaseAdmin, {
            subscription,
            metadata: buildSubscriptionMetadata({
              orgId: member.org_id,
              subscriptionId: subscription.id,
              contactId: subscription.contact_id,
              companyId: subscription.company_id,
            }),
          });
          const { data: fresh } = await supabaseAdmin
            .from("client_subscriptions")
            .select("*")
            .eq("id", subscription.id)
            .single();
          return new Response(JSON.stringify({ subscription: fresh }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!stripeSubId) {
          if (action === "cancel_now") {
            const cancellableDraftStatuses = new Set([
              "pending_setup",
              "past_due",
              "paused",
            ]);
            if (!cancellableDraftStatuses.has(subscription.status)) {
              return createErrorResponse(
                400,
                "This subscription is not active in Stripe yet. Send a setup link first.",
              );
            }
            const now = new Date().toISOString();
            await supabaseAdmin
              .from("client_subscriptions")
              .update({
                status: "canceled",
                canceled_at: now,
                cancel_at_period_end: false,
                updated_at: now,
              })
              .eq("id", subscription.id);
            const { data: fresh } = await supabaseAdmin
              .from("client_subscriptions")
              .select("*")
              .eq("id", subscription.id)
              .single();
            return new Response(JSON.stringify({ subscription: fresh }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return createErrorResponse(
            400,
            "This subscription is not active in Stripe yet. Send a setup link first.",
          );
        }

        let updatedSub;
        const now = new Date().toISOString();

        switch (action) {
          case "pause": {
            const pauseDaysRaw = body.pause_days;
            const pauseDays =
              pauseDaysRaw == null || pauseDaysRaw === undefined
                ? null
                : Number(pauseDaysRaw);
            const pauseCollection: {
              behavior: "mark_uncollectible";
              resumes_at?: number;
            } = { behavior: "mark_uncollectible" };
            if (
              pauseDays != null &&
              Number.isFinite(pauseDays) &&
              pauseDays > 0
            ) {
              pauseCollection.resumes_at = Math.floor(
                (Date.now() + pauseDays * 24 * 60 * 60 * 1000) / 1000,
              );
            }
            updatedSub = await stripe.subscriptions.update(stripeSubId, {
              pause_collection: pauseCollection,
            });
            await applyStripeSubscriptionSnapshot(
              supabaseAdmin,
              subscription.id,
              updatedSub,
            );
            break;
          }
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
          case "undo_cancel":
            updatedSub = await stripe.subscriptions.update(stripeSubId, {
              cancel_at_period_end: false,
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
