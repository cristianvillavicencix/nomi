import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  buildSubscriptionContractVariables,
  mergeContractTerms,
} from "../_shared/subscriptionContractTerms.ts";

type GetBody = {
  short_code?: string;
};

const hasPlaceholders = (body?: string | null) =>
  /\{\{\w+\}\}/.test(body ?? "");

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as GetBody;
      const shortCode = String(body.short_code ?? "").trim();
      if (!shortCode) {
        return createErrorResponse(400, "Missing short_code");
      }

      const { data: tokenRow, error: tokenError } = await supabaseAdmin
        .from("public_client_subscription_setup_tokens")
        .select("org_id, subscription_id, purpose")
        .eq("short_code", shortCode)
        .eq("purpose", "agreement")
        .maybeSingle();

      if (tokenError || !tokenRow) {
        return createErrorResponse(404, "Invalid or expired link");
      }

      const { data: subscription } = await supabaseAdmin
        .from("client_subscriptions")
        .select(
          "id, name, amount, currency, billing_interval, line_items, status, subscription_number, description, enrollment_mode, agreement_terms_markdown, agreement_terms_version, agreement_contract_terms_id, agreement_signed_at, agreement_signatory_name, agreement_signed_ip, payment_method_last4, stripe_subscription_id, contact_id, company_id, created_by_member_id",
        )
        .eq("id", tokenRow.subscription_id)
        .eq("org_id", tokenRow.org_id)
        .maybeSingle();

      if (!subscription || subscription.enrollment_mode !== "agreement") {
        return createErrorResponse(404, "Invalid or expired link");
      }

      const [{ data: org }, { data: contact }, { data: company }, { data: terms }, { data: creator }] =
        await Promise.all([
          supabaseAdmin
            .from("organizations")
            .select("name")
            .eq("id", tokenRow.org_id)
            .maybeSingle(),
          subscription.contact_id
            ? supabaseAdmin
                .from("contacts")
                .select("first_name, last_name, email_jsonb, phone_jsonb")
                .eq("id", subscription.contact_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          subscription.company_id
            ? supabaseAdmin
                .from("companies")
                .select("name, address, city, state_abbr, zipcode")
                .eq("id", subscription.company_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          subscription.agreement_contract_terms_id
            ? supabaseAdmin
                .from("organization_contract_terms")
                .select("title, version, default_variables")
                .eq("id", subscription.agreement_contract_terms_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          subscription.created_by_member_id
            ? supabaseAdmin
                .from("organization_members")
                .select("first_name, last_name")
                .eq("id", subscription.created_by_member_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

      const contactName = contact
        ? [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim()
        : "";
      const companyName =
        typeof company?.name === "string" ? company.name.trim() : "";
      const clientName = companyName || contactName || "Client";
      const clientRepresentative = contactName || null;
      const providerRepresentative = creator
        ? [creator.first_name, creator.last_name].filter(Boolean).join(" ").trim() ||
          null
        : null;
      const clientCity =
        typeof company?.city === "string" ? company.city.trim() : "";
      const clientState =
        typeof company?.state_abbr === "string" ? company.state_abbr.trim() : "";
      const clientZip =
        typeof company?.zipcode === "string" ? company.zipcode.trim() : "";
      const clientCityStateZip =
        [clientCity, clientState, clientZip].filter(Boolean).join(", ") || null;
      const clientAddress = [
        company?.address,
        clientCity,
        clientState,
        clientZip,
      ]
        .map((part) => (typeof part === "string" ? part.trim() : ""))
        .filter(Boolean)
        .join(", ") || "—";

      const contactEmails = Array.isArray(contact?.email_jsonb)
        ? contact.email_jsonb
        : [];
      const contactPhones = Array.isArray(contact?.phone_jsonb)
        ? contact.phone_jsonb
        : [];
      let clientEmail: string | null = null;
      let clientPhone: string | null = null;
      for (const entry of contactEmails) {
        const value =
          typeof entry?.email === "string" ? entry.email.trim() : "";
        if (value) {
          clientEmail = value;
          break;
        }
      }
      for (const entry of contactPhones) {
        const value =
          typeof entry?.number === "string" ? entry.number.trim() : "";
        if (value) {
          clientPhone = value;
          break;
        }
      }

      let termsMarkdown = String(subscription.agreement_terms_markdown ?? "");
      if (hasPlaceholders(termsMarkdown)) {
        const lineItems = Array.isArray(subscription.line_items)
          ? subscription.line_items
          : [];
        const vars = buildSubscriptionContractVariables({
          clientName,
          clientAddress,
          clientCityStateZip,
          clientEmail,
          clientPhone,
          clientRepresentative,
          providerRepresentative,
          subscriptionDescription: subscription.description ?? null,
          subscriptionName: subscription.name ?? "Subscription",
          subscriptionNumber: subscription.subscription_number ?? null,
          amount: Number(subscription.amount) || 0,
          currency: subscription.currency ?? "USD",
          billingInterval: subscription.billing_interval ?? "monthly",
          lineItems,
          termsVersion:
            subscription.agreement_terms_version ?? terms?.version ?? "1.0",
          defaultVariables:
            (terms?.default_variables as Record<string, string> | null) ?? null,
        });
        const signedAt = subscription.agreement_signed_at?.slice(0, 10);
        if (signedAt) {
          vars.signed_at = signedAt;
          vars.accepted_at = signedAt;
          vars.contract_date = signedAt;
        }
        if (subscription.agreement_signed_ip?.trim()) {
          vars.signed_ip = subscription.agreement_signed_ip.trim();
        }
        termsMarkdown = mergeContractTerms(termsMarkdown, vars);
        // Persist repair so staff overview and future opens stay filled.
        await supabaseAdmin
          .from("client_subscriptions")
          .update({
            agreement_terms_markdown: termsMarkdown,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);
      }

      const alreadyActive =
        subscription.status === "active" ||
        subscription.status === "trialing" ||
        Boolean(subscription.stripe_subscription_id?.trim());
      const alreadySigned = Boolean(subscription.agreement_signed_at);
      const cardOnFile = Boolean(subscription.payment_method_last4?.trim());

      return new Response(
        JSON.stringify({
          short_code: shortCode,
          subscription_id: subscription.id,
          subscription_name: subscription.name,
          subscription_number: subscription.subscription_number ?? null,
          subscription_description: subscription.description ?? null,
          amount: Number(subscription.amount),
          currency: subscription.currency ?? "USD",
          billing_interval: subscription.billing_interval,
          line_items: Array.isArray(subscription.line_items)
            ? subscription.line_items
            : [],
          terms_markdown: termsMarkdown,
          terms_version: subscription.agreement_terms_version ?? terms?.version ?? null,
          contract_title: terms?.title ?? null,
          organization_name: org?.name ?? null,
          client_name: clientName,
          client_representative: clientRepresentative,
          provider_representative: providerRepresentative,
          client_address: clientAddress,
          status: subscription.status,
          already_active: alreadyActive,
          already_signed: alreadySigned,
          signatory_name: subscription.agreement_signatory_name ?? null,
          card_on_file: cardOnFile,
          needs_card: alreadySigned && !cardOnFile && !alreadyActive,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("get_public_subscription_agreement.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
