import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import {
  isStripeMockMode,
  resolveContactEmail,
} from "../_shared/clientProposalBilling.ts";
import { getStripeForOrg } from "../_shared/stripeClient.ts";
import {
  isOrgClientInvoiceCheckoutEnabled,
  resolveOrgStripePublishableKey,
} from "../_shared/organizationStripeSettings.ts";
import {
  resolveClientStripePaymentMethod,
  resolveSubscriptionStripeCustomer,
} from "../_shared/clientSubscriptionStripe.ts";

type PrepareBody = {
  company_id?: number | null;
  contact_id?: number | null;
  email_to?: string | null;
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
          return createErrorResponse(403, "You cannot prepare subscription payments");
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

        const body = (await req.json()) as PrepareBody;
        const companyId = body.company_id ? Number(body.company_id) : null;
        const contactId = body.contact_id ? Number(body.contact_id) : null;

        if (!companyId && !contactId) {
          return createErrorResponse(400, "Select a client to bill");
        }

        const clientInfo = await resolveClientName({ contactId, companyId });
        const resolvedCompanyId = companyId ?? clientInfo.companyId ?? null;

        let recipientEmail = body.email_to?.trim() ?? "";
        if (!recipientEmail && contactId) {
          recipientEmail =
            (await resolveContactEmail(supabaseAdmin, contactId)) ?? "";
        }
        if (!recipientEmail || !emailRegex.test(recipientEmail)) {
          return createErrorResponse(
            400,
            "A valid client email is required to save a card",
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

        const setupIntent = await stripe.setupIntents.create({
          customer: customer.id,
          usage: "off_session",
          payment_method_types: ["card"],
          metadata: {
            org_id: String(member.org_id),
            contact_id: contactId ? String(contactId) : "",
            company_id: resolvedCompanyId ? String(resolvedCompanyId) : "",
          },
        });

        if (!setupIntent.client_secret) {
          return createErrorResponse(500, "Could not prepare card setup");
        }

        const publishableKey =
          (await resolveOrgStripePublishableKey(member.org_id)) ?? "";

        if (!publishableKey.trim()) {
          return createErrorResponse(
            400,
            "Stripe publishable key is missing. Add pk_… under Settings → Integrations → Stripe, or set STRIPE_PUBLISHABLE_KEY on the server.",
          );
        }

        return new Response(
          JSON.stringify({
            client_secret: setupIntent.client_secret,
            publishable_key: publishableKey,
            stripe_customer_id: customer.id,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        console.error("prepare_client_subscription_payment.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
