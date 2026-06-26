import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { resolveProposalTermsMarkdown } from "../_shared/proposalFlow.ts";

type GetPublicProposalBody = {
  token?: string;
  short_code?: string;
  mark_viewed?: boolean;
};

const loadTokenRow = async (token?: string, shortCode?: string) => {
  if (token) {
    return supabaseAdmin
      .from("public_proposal_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();
  }
  if (shortCode) {
    return supabaseAdmin
      .from("public_proposal_tokens")
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
      const body = (await req.json()) as GetPublicProposalBody;
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
        return createErrorResponse(410, "This proposal link has expired");
      }

      const proposalSelectWithContent = `
          id,
          title,
          status,
          amount,
          proposal_number,
          currency,
          validity_days,
          valid_until,
          deposit_amount,
          balance_amount,
          deposit_percent,
          recurring_summary,
          notes,
          sent_at,
          viewed_at,
          accepted_at,
          contract_id,
          content,
          org_id,
          company_id,
          contact_id,
          organization_member_id,
          recurring_summary
        `;
      const proposalSelectBase = proposalSelectWithContent.replace(
        ",\n          content",
        "",
      );

      let proposal: Record<string, unknown> | null = null;
      let proposalError: { message?: string } | null = null;

      const withContent = await supabaseAdmin
        .from("proposals")
        .select(proposalSelectWithContent)
        .eq("id", tokenRow.proposal_id)
        .eq("org_id", tokenRow.org_id)
        .single();

      proposal = withContent.data;
      proposalError = withContent.error;

      if (proposalError) {
        const fallback = await supabaseAdmin
          .from("proposals")
          .select(proposalSelectBase)
          .eq("id", tokenRow.proposal_id)
          .eq("org_id", tokenRow.org_id)
          .single();
        if (!fallback.error && fallback.data) {
          proposal = { ...fallback.data, content: {} };
          proposalError = null;
        }
      }

      if (proposalError || !proposal) {
        console.error("get_public_proposal.proposal", proposalError);
        return createErrorResponse(404, "Proposal not found");
      }

      const companyId = proposal.company_id as number | null | undefined;
      const contactId = proposal.contact_id as number | null | undefined;
      const memberId = proposal.organization_member_id as
        | number
        | null
        | undefined;

      const [
        { data: lineItems },
        { data: installments },
        { data: org },
        { data: company },
        { data: contact },
        { data: member },
      ] = await Promise.all([
        supabaseAdmin
          .from("proposal_line_items")
          .select(
            "description, quantity, unit_price, line_total, billing_type, billing_interval, sort_order",
          )
          .eq("proposal_id", proposal.id)
          .order("sort_order", { ascending: true }),
        supabaseAdmin
          .from("proposal_payment_installments")
          .select(
            "installment_number, label, due_date, amount, billing_type, status",
          )
          .eq("proposal_id", proposal.id)
          .order("installment_number", { ascending: true }),
        supabaseAdmin
          .from("organizations")
          .select("name, client_billing_mode")
          .eq("id", tokenRow.org_id)
          .maybeSingle(),
        companyId
          ? supabaseAdmin
              .from("companies")
              .select("id, name")
              .eq("id", companyId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        contactId
          ? supabaseAdmin
              .from("contacts")
              .select("id, first_name, last_name")
              .eq("id", contactId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        memberId
          ? supabaseAdmin
              .from("organization_members")
              .select("id, first_name, last_name, email")
              .eq("id", memberId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      let contract: {
        id: number;
        status: string;
        signed_at: string | null;
        deposit_paid_at: string | null;
        terms_snapshot: string | null;
      } | null = null;

      if (proposal.contract_id) {
        const { data: contractRow } = await supabaseAdmin
          .from("contracts")
          .select("id, status, signed_at, deposit_paid_at, terms_snapshot")
          .eq("id", proposal.contract_id)
          .maybeSingle();
        contract = contractRow ?? null;
      }

      const resolvedTerms = await resolveProposalTermsMarkdown(
        supabaseAdmin,
        proposal,
        lineItems ?? [],
        installments ?? [],
      );

      if (body.mark_viewed !== false && !proposal.viewed_at) {
        const now = new Date().toISOString();
        await supabaseAdmin
          .from("proposals")
          .update({
            viewed_at: now,
            status: proposal.status === "sent" ? "viewed" : proposal.status,
          })
          .eq("id", proposal.id);
      }

      return new Response(
        JSON.stringify({
          token: tokenRow.token,
          proposal,
          line_items: lineItems ?? [],
          installments: installments ?? [],
          contract,
          terms_markdown: resolvedTerms.markdown || null,
          terms_title: resolvedTerms.title,
          organization: {
            name: org?.name ?? "LBS",
            logo_url: null,
          },
          client_billing_mode:
            org?.client_billing_mode === "stripe" ? "stripe" : "manual",
          company: company?.name
            ? { id: company.id, name: company.name }
            : null,
          contact: contact
            ? {
                id: contact.id,
                first_name: contact.first_name,
                last_name: contact.last_name,
              }
            : null,
          member: member
            ? {
                id: member.id,
                first_name: member.first_name,
                last_name: member.last_name,
                email: member.email,
              }
            : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("get_public_proposal.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
