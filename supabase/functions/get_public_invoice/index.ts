import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getPublicInvoiceOrganization } from "../_shared/invoiceOrganizationInfo.ts";

type GetPublicInvoiceBody = {
  token?: string;
  short_code?: string;
};

const loadTokenRow = async (token?: string, shortCode?: string) => {
  if (token) {
    return supabaseAdmin
      .from("public_client_invoice_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();
  }
  if (shortCode) {
    return supabaseAdmin
      .from("public_client_invoice_tokens")
      .select("*")
      .eq("short_code", shortCode)
      .maybeSingle();
  }
  return { data: null, error: null };
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as GetPublicInvoiceBody;
      const token = String(body.token ?? "").trim();
      const shortCode = String(body.short_code ?? "").trim();

      if (!token && !shortCode) {
        return createErrorResponse(400, "Missing token");
      }

      const { data: tokenRow, error: tokenError } = await loadTokenRow(
        token || undefined,
        shortCode || undefined,
      );

      if (tokenError || !tokenRow) {
        return createErrorResponse(404, "Invalid or expired link");
      }

      if (
        tokenRow.expires_at &&
        new Date(tokenRow.expires_at).getTime() < Date.now()
      ) {
        return createErrorResponse(410, "This invoice link has expired");
      }

      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from("client_invoices")
        .select(
          `
          id,
          invoice_number,
          issue_date,
          due_date,
          amount,
          subtotal,
          discount_amount,
          fee_amount,
          currency,
          terms,
          description,
          notes,
          status,
          reference,
          save_card_for_future_charges,
          upfront_percent,
          auto_charge_remainder,
          amount_paid,
          remainder_schedule
        `,
        )
        .eq("id", tokenRow.invoice_id)
        .eq("org_id", tokenRow.org_id)
        .maybeSingle();

      if (invoiceError || !invoice) {
        console.error("get_public_invoice.invoice_error", invoiceError);
        return createErrorResponse(404, "Invoice not found");
      }

      const invoicePayload = {
        ...invoice,
        upfront_percent: Number(
          (invoice as Record<string, unknown>).upfront_percent ?? 100,
        ),
        auto_charge_remainder: Boolean(
          (invoice as Record<string, unknown>).auto_charge_remainder ?? false,
        ),
        amount_paid: Number(
          (invoice as Record<string, unknown>).amount_paid ?? 0,
        ),
      };

      if (invoice.status === "void") {
        return createErrorResponse(410, "This invoice is no longer available");
      }

      const { data: lineItems } = await supabaseAdmin
        .from("client_invoice_line_items")
        .select(
          "description, quantity, unit, unit_price, line_total, sort_order",
        )
        .eq("invoice_id", invoice.id)
        .order("sort_order", { ascending: true });

      const defaultOrganization = getPublicInvoiceOrganization();

      let companyName: string | null = null;
      let contactName: string | null = null;
      let billToEmail: string | null = null;
      let billToPhone: string | null = null;

      const { data: invoiceRow } = await supabaseAdmin
        .from("client_invoices")
        .select("company_id, contact_id, recipient_email")
        .eq("id", invoice.id)
        .maybeSingle();

      if (invoiceRow?.company_id) {
        const { data: company } = await supabaseAdmin
          .from("companies")
          .select("name")
          .eq("id", invoiceRow.company_id)
          .maybeSingle();
        companyName = company?.name ?? null;
      }

      if (invoiceRow?.contact_id) {
        const { data: contact } = await supabaseAdmin
          .from("contacts")
          .select("first_name, last_name, email_jsonb, phone_jsonb")
          .eq("id", invoiceRow.contact_id)
          .maybeSingle();
        if (contact) {
          contactName = [contact.first_name, contact.last_name]
            .filter(Boolean)
            .join(" ");
          const emails = contact.email_jsonb as Array<{ email?: string; isPrimary?: boolean }> | null;
          const phones = contact.phone_jsonb as Array<{ number?: string; isPrimary?: boolean }> | null;
          billToEmail =
            emails?.find((row) => row.isPrimary)?.email?.trim() ??
            emails?.[0]?.email?.trim() ??
            invoiceRow.recipient_email ??
            null;
          billToPhone =
            phones?.find((row) => row.isPrimary)?.number?.trim() ??
            phones?.[0]?.number?.trim() ??
            null;
        }
      }

      const orgAddress = defaultOrganization.address;

      let portalToken: string | null = null;
      if (invoiceRow?.contact_id) {
        const { data: portalAccount } = await supabaseAdmin
          .from("client_portal_accounts")
          .select("invitation_token")
          .eq("org_id", tokenRow.org_id)
          .eq("contact_id", invoiceRow.contact_id)
          .eq("active", true)
          .maybeSingle();
        portalToken = portalAccount?.invitation_token ?? null;
      }

      await supabaseAdmin
        .from("public_client_invoice_tokens")
        .update({ uses_count: (tokenRow.uses_count ?? 0) + 1 })
        .eq("id", tokenRow.id);

      return new Response(
        JSON.stringify({
          token: tokenRow.token,
          invoice: invoicePayload,
          line_items: lineItems ?? [],
          organization: {
            name: defaultOrganization.name,
            website: defaultOrganization.website,
            address: orgAddress,
          },
          bill_to: {
            company_name: companyName,
            contact_name: contactName,
            email: billToEmail,
            phone: billToPhone,
          },
          portal_token: portalToken,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("get_public_invoice.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
