import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware } from "../_shared/authentication.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { generateSecureToken } from "../_shared/formV2Schema.ts";
import { generateUniqueShortCode } from "../_shared/formTokenUtils.ts";

type SendProposalBody = {
  proposal_id: number;
  expires_in_days?: number;
  base_url?: string;
};

const resolveBaseUrl = (requested?: string) => {
  const trimmed = requested?.trim();
  if (trimmed) return trimmed.replace(/\/$/, "");
  const envUrl =
    Deno.env.get("PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("VITE_PUBLIC_APP_URL")?.trim();
  return envUrl?.replace(/\/$/, "") ?? "";
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const user = await AuthMiddleware(req);
      const member = await getUserOrganizationMember(user.id);
      if (!member?.id) {
        return createErrorResponse(401, "Unauthorized");
      }

      if (
        !member.administrator &&
        !hasMemberCapability(member, "proposals.send")
      ) {
        return createErrorResponse(403, "You cannot send proposals");
      }

      const body = (await req.json()) as SendProposalBody;
      const proposalId = Number(body.proposal_id);
      if (!Number.isFinite(proposalId)) {
        return createErrorResponse(400, "Invalid proposal_id");
      }

      const { data: proposal, error: proposalError } = await supabaseAdmin
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .eq("org_id", member.org_id)
        .single();

      if (proposalError || !proposal) {
        return createErrorResponse(404, "Proposal not found");
      }

      const expiresInDays = Number(body.expires_in_days);
      const expiresAt = Number.isFinite(expiresInDays)
        ? new Date(
            Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
          ).toISOString()
        : proposal.valid_until
          ? new Date(`${proposal.valid_until}T23:59:59`).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const token = generateSecureToken();
      const shortCode = await generateUniqueShortCode(async (code) => {
        const { data } = await supabaseAdmin
          .from("public_proposal_tokens")
          .select("id")
          .eq("short_code", code)
          .maybeSingle();
        return Boolean(data?.id);
      });

      const { data: tokenRow, error: tokenError } = await supabaseAdmin
        .from("public_proposal_tokens")
        .insert({
          token,
          short_code: shortCode,
          org_id: member.org_id,
          proposal_id: proposalId,
          expires_at: expiresAt,
          max_uses: null,
          created_by_member_id: member.id,
        })
        .select("token, short_code, expires_at")
        .single();

      if (tokenError || !tokenRow) {
        console.error("send_proposal.token_error", tokenError);
        return createErrorResponse(500, "Could not generate proposal link");
      }

      const now = new Date().toISOString();
      await supabaseAdmin
        .from("proposals")
        .update({
          status: "sent",
          sent_at: now,
          updated_at: now,
        })
        .eq("id", proposalId);

      if (proposal.deal_id) {
        await supabaseAdmin
          .from("deals")
          .update({
            stage: "proposal_sent",
            lifecycle_phase: "opportunity",
            updated_at: now,
          })
          .eq("id", proposal.deal_id);
      }

      if (proposal.contact_id) {
        await supabaseAdmin
          .from("contacts")
          .update({ lead_stage: "quoted" })
          .eq("id", proposal.contact_id);
      }

      const baseUrl = resolveBaseUrl(body.base_url);
      const path = `/proposal/${tokenRow.token}`;
      const url = baseUrl ? `${baseUrl}${path}` : path;
      const shortPath = `/pr/${tokenRow.short_code}`;
      const short_url = baseUrl ? `${baseUrl}${shortPath}` : shortPath;

      return new Response(
        JSON.stringify({
          token: tokenRow.token,
          short_code: tokenRow.short_code,
          url,
          short_url,
          expires_at: tokenRow.expires_at,
          proposal_id: proposalId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("send_proposal.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
