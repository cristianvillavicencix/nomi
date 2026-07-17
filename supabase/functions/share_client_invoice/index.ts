import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { generateSecureToken } from "../_shared/formV2Schema.ts";
import { generateUniqueShortCode } from "../_shared/formTokenUtils.ts";
import { resolvePublicAppBaseUrl } from "../_shared/publicAppUrl.ts";

type ShareBody = {
  invoice_id?: number;
  base_url?: string;
  expires_in_days?: number;
};

const resolveBaseUrl = (requested?: string) => {
  const trimmed = requested?.trim();
  if (trimmed) return trimmed.replace(/\/$/, "");
  return resolvePublicAppBaseUrl();
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
          return createErrorResponse(403, "You cannot share invoices");
        }

        const body = (await req.json()) as ShareBody;
        const invoiceId = Number(body.invoice_id);
        if (!Number.isFinite(invoiceId)) {
          return createErrorResponse(400, "Invalid invoice_id");
        }

        const { data: invoice } = await supabaseAdmin
          .from("client_invoices")
          .select("id, invoice_number, status")
          .eq("id", invoiceId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (!invoice?.id) {
          return createErrorResponse(404, "Invoice not found");
        }

        if (invoice.status === "paid") {
          return createErrorResponse(409, "This invoice is already paid");
        }

        if (invoice.status === "void") {
          return createErrorResponse(400, "Cannot share a void invoice");
        }

        const expiresInDays = Number(body.expires_in_days);
        const expiresAt = Number.isFinite(expiresInDays)
          ? new Date(
              Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
            ).toISOString()
          : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

        const token = generateSecureToken();
        const shortCode = await generateUniqueShortCode(async (code) => {
          const { data: proposalHit } = await supabaseAdmin
            .from("public_proposal_tokens")
            .select("id")
            .eq("short_code", code)
            .maybeSingle();
          if (proposalHit?.id) return true;

          const { data: invoiceHit } = await supabaseAdmin
            .from("public_client_invoice_tokens")
            .select("id")
            .eq("short_code", code)
            .maybeSingle();
          return Boolean(invoiceHit?.id);
        });

        const { data: tokenRow, error: tokenError } = await supabaseAdmin
          .from("public_client_invoice_tokens")
          .insert({
            token,
            short_code: shortCode,
            org_id: member.org_id,
            invoice_id: invoiceId,
            expires_at: expiresAt,
            max_uses: null,
            created_by_member_id: member.id,
          })
          .select("token, short_code, expires_at")
          .single();

        if (tokenError || !tokenRow) {
          console.error("share_client_invoice.token_error", tokenError);
          return createErrorResponse(500, "Could not generate invoice link");
        }

        const baseUrl = resolveBaseUrl(body.base_url);
        const path = `/portal/invoice/${tokenRow.token}?pay=1`;
        const url = baseUrl ? `${baseUrl}${path}` : path;
        const shortPath = `/iv/${tokenRow.short_code}?pay=1`;
        const short_url = baseUrl ? `${baseUrl}${shortPath}` : shortPath;

        return new Response(
          JSON.stringify({
            token: tokenRow.token,
            short_code: tokenRow.short_code,
            url,
            short_url,
            expires_at: tokenRow.expires_at,
            invoice_id: invoiceId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("share_client_invoice.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
