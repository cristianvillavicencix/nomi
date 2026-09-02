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
import { resolveClientAppBaseUrl } from "../_shared/publicAppUrl.ts";
import {
  applyStripeSubscriptionSnapshot,
  buildSubscriptionMetadata,
  normalizeSubscriptionLineItems,
  createStripeSubscriptionSetupCheckout,
  createStripeSubscriptionWithCard,
  deliverSubscriptionAgreementLink,
  deliverSubscriptionSetupLink,
  resolveClientStripePaymentMethod,
  resolveSubscriptionClientName,
  resolveSubscriptionStripeCustomer,
  sumSubscriptionLineItemsAmount,
  type BillingInterval,
  type ClientSubscriptionRow,
} from "../_shared/clientSubscriptionStripe.ts";
import {
  buildSubscriptionContractVariables,
  mergeContractTerms,
  pickContractTermsForSubscription,
  type ContractTermsRow,
} from "../_shared/subscriptionContractTerms.ts";

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
  enrollment_mode?: "direct" | "agreement";
  agreement_terms_markdown?: string | null;
  /** When true, keep staff-edited markdown instead of reloading the Contracts template. */
  agreement_terms_edited?: boolean | null;
  agreement_contract_terms_id?: number | null;
  payment_mode?: "saved_card" | "staff_card" | "request_setup";
  payment_method_id?: string | null;
  send_email?: boolean;
  send_sms?: boolean;
  email_to?: string | null;
  sms_to?: string | null;
  message?: string | null;
  subject?: string | null;
  reference_number?: string | null;
  base_url?: string | null;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
        const normalizedLines = normalizeSubscriptionLineItems(
          lineItems,
          name,
          amount,
        );
        const computedAmount = sumSubscriptionLineItemsAmount(normalizedLines);
        if (Math.round(computedAmount * 100) !== Math.round(amount * 100)) {
          return createErrorResponse(
            400,
            "Amount must match the sum of line items",
          );
        }
        if (!["weekly", "monthly", "yearly"].includes(billingInterval)) {
          return createErrorResponse(400, "Invalid billing interval");
        }

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("name")
          .eq("id", member.org_id)
          .maybeSingle();

        const clientInfo = await resolveSubscriptionClientName(supabaseAdmin, {
          contactId,
          companyId,
        });
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

        const startsAt = body.starts_at?.trim() || null;
        const endsAt = body.ends_at?.trim() || null;
        const referenceNumber = body.reference_number?.trim() || null;
        const enrollmentMode =
          body.enrollment_mode === "agreement" ? "agreement" : "direct";
        const paymentMode =
          body.payment_mode ??
          (body.payment_method_id?.trim()
            ? "staff_card"
            : "request_setup");

        let agreementTermsMarkdown =
          body.agreement_terms_markdown?.trim() || "";
        let agreementTermsVersion: string | null = null;
        let agreementContractTermsId: number | null = null;

        const { data: subscriptionNumber, error: numberError } =
          await supabaseAdmin.rpc("next_client_subscription_number", {
            p_org_id: member.org_id,
          });
        if (numberError || !subscriptionNumber) {
          return createErrorResponse(
            500,
            numberError?.message ?? "Could not generate subscription number",
          );
        }

        if (enrollmentMode === "agreement") {
          const { data: templates = [] } = await supabaseAdmin
            .from("organization_contract_terms")
            .select(
              "id, version, title, body_markdown, default_variables, is_default, is_active, slug",
            )
            .eq("org_id", member.org_id)
            .eq("is_active", true)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: false });

          const packageIds = [
            ...new Set(
              normalizedLines
                .map((line) =>
                  line.package_id != null ? Number(line.package_id) : null,
                )
                .filter((id): id is number => id != null && Number.isFinite(id)),
            ),
          ];
          const packageDefaults = new Map<number, number | null | undefined>();
          if (packageIds.length > 0) {
            const { data: pkgs } = await supabaseAdmin
              .from("service_packages")
              .select("id, default_contract_terms_id")
              .eq("org_id", member.org_id)
              .in("id", packageIds);
            for (const pkg of pkgs ?? []) {
              packageDefaults.set(
                Number(pkg.id),
                pkg.default_contract_terms_id != null
                  ? Number(pkg.default_contract_terms_id)
                  : null,
              );
            }
          }

          const requestedId = body.agreement_contract_terms_id
            ? Number(body.agreement_contract_terms_id)
            : null;
          const picked = pickContractTermsForSubscription({
            requestedId,
            lineItems: normalizedLines,
            packageDefaults,
            templates: (templates ?? []) as ContractTermsRow[],
          });

          if (picked) {
            agreementContractTermsId = Number(picked.id);
            agreementTermsVersion = picked.version?.trim() || null;
          }

          let clientAddress = "—";
          let companyName = "";
          let companyCity = "";
          let companyState = "";
          let companyZip = "";
          if (resolvedCompanyId) {
            const { data: company } = await supabaseAdmin
              .from("companies")
              .select("name, address, city, state_abbr, zipcode")
              .eq("id", resolvedCompanyId)
              .maybeSingle();
            if (typeof company?.name === "string" && company.name.trim()) {
              companyName = company.name.trim();
            }
            companyCity =
              typeof company?.city === "string" ? company.city.trim() : "";
            companyState =
              typeof company?.state_abbr === "string"
                ? company.state_abbr.trim()
                : "";
            companyZip =
              typeof company?.zipcode === "string"
                ? company.zipcode.trim()
                : "";
            const parts = [
              company?.address,
              companyCity,
              companyState,
              companyZip,
            ]
              .map((part) =>
                typeof part === "string" ? part.trim() : "",
              )
              .filter(Boolean);
            if (parts.length > 0) clientAddress = parts.join(", ");
          }

          let representativeName = "";
          let clientEmail: string | null = null;
          let clientPhone: string | null = null;
          if (contactId) {
            const { data: contact } = await supabaseAdmin
              .from("contacts")
              .select("first_name, last_name, email_jsonb, phone_jsonb")
              .eq("id", contactId)
              .maybeSingle();
            representativeName = [contact?.first_name, contact?.last_name]
              .filter(Boolean)
              .join(" ")
              .trim();
            const emails = Array.isArray(contact?.email_jsonb)
              ? contact.email_jsonb
              : [];
            const phones = Array.isArray(contact?.phone_jsonb)
              ? contact.phone_jsonb
              : [];
            for (const entry of emails) {
              const value =
                typeof entry?.email === "string" ? entry.email.trim() : "";
              if (value) {
                clientEmail = value;
                break;
              }
            }
            for (const entry of phones) {
              const value =
                typeof entry?.number === "string" ? entry.number.trim() : "";
              if (value) {
                clientPhone = value;
                break;
              }
            }
          }

          const clientCityStateZip = [
            companyCity,
            companyState,
            companyZip,
          ]
            .filter(Boolean)
            .join(", ") || null;

          const templateBody = picked?.body_markdown?.trim() || "";
          const defaults =
            (picked?.default_variables as Record<string, string> | null) ?? {};

          // Prefer the live template from Contracts so edits there always apply.
          // Only keep client-sent markdown when staff explicitly edited terms
          // in the subscription form.
          const staffEditedTerms = body.agreement_terms_edited === true;
          const sourceBody =
            staffEditedTerms && agreementTermsMarkdown
              ? agreementTermsMarkdown
              : templateBody || agreementTermsMarkdown;
          if (!sourceBody) {
            return createErrorResponse(
              400,
              "Add subscription terms (or publish a contract template) before sending for signature",
            );
          }

          // Always merge so leftover {{placeholders}} (or a raw template paste) get filled.
          const vars = buildSubscriptionContractVariables({
            clientName:
              companyName ||
              representativeName ||
              clientInfo.name ||
              "Client",
            clientAddress,
            clientCityStateZip,
            clientEmail: clientEmail || clientInfo.email || null,
            clientPhone,
            clientRepresentative: representativeName || null,
            providerRepresentative: [member.first_name, member.last_name]
              .filter(Boolean)
              .join(" ")
              .trim() || null,
            subscriptionDescription: body.description?.trim() || null,
            subscriptionName: name,
            subscriptionNumber: String(subscriptionNumber),
            amount,
            currency: (body.currency ?? "USD").toUpperCase(),
            billingInterval,
            lineItems: normalizedLines,
            termsVersion: agreementTermsVersion ?? "1.0",
            defaultVariables: defaults,
          });
          agreementTermsMarkdown = mergeContractTerms(sourceBody, vars);
        }

        const { data: subscription, error: insertError } = await supabaseAdmin
          .from("client_subscriptions")
          .insert({
            org_id: member.org_id,
            company_id: resolvedCompanyId,
            contact_id: contactId,
            deal_id: dealId,
            subscription_number: subscriptionNumber as string,
            reference_number: referenceNumber,
            name,
            description: body.description?.trim() || null,
            amount,
            currency: (body.currency ?? "USD").toUpperCase(),
            billing_interval: billingInterval,
            line_items: normalizedLines,
            starts_at: startsAt,
            ends_at: endsAt,
            status: "pending_setup",
            enrollment_mode: enrollmentMode,
            agreement_contract_terms_id:
              enrollmentMode === "agreement" ? agreementContractTermsId : null,
            agreement_terms_markdown:
              enrollmentMode === "agreement" ? agreementTermsMarkdown : null,
            agreement_terms_version:
              enrollmentMode === "agreement" ? agreementTermsVersion : null,
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

        await supabaseAdmin
          .from("client_subscriptions")
          .update({
            stripe_customer_id: customer.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        const metadata = buildSubscriptionMetadata({
          orgId: member.org_id,
          subscriptionId: subscription.id,
          contactId,
          companyId: resolvedCompanyId,
        });

        const baseUrl = resolveClientAppBaseUrl(body.base_url);
        const returnQuery = `tab=subscriptions&subscription=${subscription.id}`;

        let checkoutUrl: string | null = null;
        let usedSavedCard = false;
        let usedStaffCard = false;
        let emailSent = false;
        let emailSkipped = false;
        let smsSent = false;
        let smsSkipped = false;

        // Agreement path: no Stripe sub / setup Checkout yet — client signs first.
        if (enrollmentMode === "agreement") {
          const shouldSendEmail = body.send_email !== false;
          const shouldSendSms = body.send_sms === true;
          let clientLabel: string | null = null;
          if (contactId) {
            const { data: contactRow } = await supabaseAdmin
              .from("contacts")
              .select("first_name, last_name")
              .eq("id", contactId)
              .maybeSingle();
            clientLabel = [contactRow?.first_name, contactRow?.last_name]
              .filter(Boolean)
              .join(" ")
              .trim() || null;
          }
          if (!clientLabel && resolvedCompanyId) {
            const { data: companyRow } = await supabaseAdmin
              .from("companies")
              .select("name")
              .eq("id", resolvedCompanyId)
              .maybeSingle();
            clientLabel = companyRow?.name?.trim() || null;
          }
          const delivery = await deliverSubscriptionAgreementLink(
            supabaseAdmin,
            {
              orgId: member.org_id,
              memberId: Number(member.id),
              orgName: org?.name ?? null,
              subscription: {
                ...(subscription as ClientSubscriptionRow),
                stripe_customer_id: customer.id,
              },
              baseUrl,
              emailTo: recipientEmail,
              smsTo: body.sms_to,
              subject: body.subject,
              message: body.message,
              sendEmail: shouldSendEmail,
              sendSms: shouldSendSms,
              clientName: clientLabel,
            },
          );
          emailSent = delivery.emailSent;
          emailSkipped = delivery.emailSkipped;
          smsSent = delivery.smsSent;
          smsSkipped = delivery.smsSkipped;

          const { data: freshAgreement } = await supabaseAdmin
            .from("client_subscriptions")
            .select("*")
            .eq("id", subscription.id)
            .single();

          return new Response(
            JSON.stringify({
              subscription: freshAgreement,
              checkout_url: null,
              agreement_share_url: freshAgreement?.setup_share_url ?? null,
              used_saved_card: false,
              used_staff_card: false,
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
        }

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
          const explicitPaymentMethodId = body.payment_method_id?.trim();
          if (explicitPaymentMethodId) {
            const pm = await stripe.paymentMethods.retrieve(
              explicitPaymentMethodId,
            );
            paymentMethodId = explicitPaymentMethodId;
            paymentMethodBrand = pm.card?.brand ?? null;
            paymentMethodLast4 = pm.card?.last4 ?? null;
            usedSavedCard = true;
          } else if (savedPayment?.stripePaymentMethodId) {
            paymentMethodId = savedPayment.stripePaymentMethodId;
            paymentMethodBrand = savedPayment.paymentMethodBrand;
            paymentMethodLast4 = savedPayment.paymentMethodLast4;
            usedSavedCard = true;
          } else {
            return createErrorResponse(
              400,
              "No saved card found for this client. Choose another payment option.",
            );
          }
        }

        if (paymentMethodId) {
          const stripeSub = await createStripeSubscriptionWithCard(stripe, {
            customerId: customer.id,
            paymentMethodId,
            name,
            amount: computedAmount,
            currency: subscription.currency,
            billingInterval,
            metadata,
            lineItems: normalizedLines,
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
          const session = await createStripeSubscriptionSetupCheckout(stripe, {
            customerId: customer.id,
            successUrl: `${baseUrl}/billing?${returnQuery}&setup=success`,
            cancelUrl: `${baseUrl}/billing?${returnQuery}&setup=cancel`,
            metadata,
          });

          checkoutUrl = session.url ?? null;
          await supabaseAdmin
            .from("client_subscriptions")
            .update({
              stripe_customer_id: customer.id,
              stripe_checkout_session_id: session.id,
              setup_checkout_url: checkoutUrl,
              status: "pending_setup",
            })
            .eq("id", subscription.id);

          const shouldSendEmail = body.send_email === true;
          const shouldSendSms = body.send_sms === true;

          if (checkoutUrl && (shouldSendEmail || shouldSendSms)) {
            const delivery = await deliverSubscriptionSetupLink(supabaseAdmin, {
              orgId: member.org_id,
              memberId: Number(member.id),
              orgName: org?.name ?? null,
              subscription: subscription as ClientSubscriptionRow,
              checkoutUrl,
              baseUrl,
              emailTo: recipientEmail,
              smsTo: body.sms_to,
              subject: body.subject,
              message: body.message,
              sendEmail: shouldSendEmail,
              sendSms: shouldSendSms,
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
