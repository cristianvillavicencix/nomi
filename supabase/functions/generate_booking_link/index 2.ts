import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { generateSecureToken } from "../_shared/formV2Schema.ts";
import { generateUniqueShortCode } from "../_shared/formTokenUtils.ts";

type GenerateBookingLinkBody = {
  contact_id?: number | null;
  company_id?: number | null;
  deal_id?: number | null;
  expires_in_days?: number;
  base_url?: string;
  organization_member_id?: number | null;
};

const resolveBaseUrl = (requested?: string) => {
  const trimmed = requested?.trim();
  if (trimmed) return trimmed.replace(/\/$/, "");
  const envUrl =
    Deno.env.get("PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("VITE_PUBLIC_APP_URL")?.trim();
  return envUrl?.replace(/\/$/, "") ?? "";
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      const member = await getUserOrganizationMember(user);
      if (!member?.org_id || !member.id) {
        return createErrorResponse(403, "Organization not found");
      }

      const canShare =
        member.administrator === true ||
        hasMemberCapability(member, "messaging.send");

      if (!canShare) {
        return createErrorResponse(
          403,
          "You don't have permission to share booking links",
        );
      }

      try {
        const body = (await req.json()) as GenerateBookingLinkBody;
        const hostMemberId = Number(body.organization_member_id ?? member.id);
        if (!Number.isFinite(hostMemberId)) {
          return createErrorResponse(400, "Invalid organization_member_id");
        }

        const { data: hostMember } = await supabaseAdmin
          .from("organization_members")
          .select("id")
          .eq("id", hostMemberId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (!hostMember?.id) {
          return createErrorResponse(404, "Team member not found");
        }

        const expiresInDays = Number(body.expires_in_days);
        const expiresAt = new Date(
          Date.now() +
            (Number.isFinite(expiresInDays) ? expiresInDays : 30) *
              24 *
              60 *
              60 *
              1000,
        ).toISOString();

        const token = generateSecureToken();
        const shortCode = await generateUniqueShortCode(async (code) => {
          const { data } = await supabaseAdmin
            .from("public_booking_tokens")
            .select("id")
            .eq("short_code", code)
            .maybeSingle();
          return Boolean(data?.id);
        });

        const { data: tokenRow, error: insertError } = await supabaseAdmin
          .from("public_booking_tokens")
          .insert({
            token,
            short_code: shortCode,
            org_id: member.org_id,
            organization_member_id: hostMemberId,
            contact_id: body.contact_id ?? null,
            company_id: body.company_id ?? null,
            deal_id: body.deal_id ?? null,
            expires_at: expiresAt,
            created_by_member_id: member.id,
          })
          .select("token, short_code, expires_at")
          .single();

        if (insertError || !tokenRow) {
          console.error("[generate_booking_link] insert error", insertError);
          return createErrorResponse(500, "Could not generate booking link");
        }

        const baseUrl = resolveBaseUrl(body.base_url);
        const path = `/book/${tokenRow.token}`;
        const url = baseUrl ? `${baseUrl}${path}` : path;
        const shortPath = `/b/${tokenRow.short_code}`;
        const short_url = baseUrl ? `${baseUrl}${shortPath}` : shortPath;

        return new Response(
          JSON.stringify({
            token: tokenRow.token,
            short_code: tokenRow.short_code,
            url,
            short_url,
            expires_at: tokenRow.expires_at,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("[generate_booking_link] error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
