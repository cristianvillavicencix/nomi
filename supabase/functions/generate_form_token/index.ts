import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { generateSecureToken } from "../_shared/formV2Schema.ts";

type GenerateTokenBody = {
  form_instance_id?: number;
  contact_id?: number | null;
  company_id?: number | null;
  deal_id?: number | null;
  expires_in_days?: number;
  max_uses?: number | null;
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

      if (!hasMemberCapability(member, "forms.manage")) {
        return createErrorResponse(
          403,
          "You don't have permission to manage forms",
        );
      }

      try {
        const body = (await req.json()) as GenerateTokenBody;
        const formInstanceId = Number(body.form_instance_id);
        if (!Number.isFinite(formInstanceId)) {
          return createErrorResponse(400, "Missing form_instance_id");
        }

        const { data: formInstance, error: formError } = await supabaseAdmin
          .from("form_instances")
          .select("id, org_id, slug, name, is_active")
          .eq("id", formInstanceId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (formError || !formInstance?.id) {
          return createErrorResponse(404, "Form not found");
        }

        if (!formInstance.is_active) {
          return createErrorResponse(400, "Form is inactive");
        }

        const expiresInDays = Number.isFinite(Number(body.expires_in_days))
          ? Number(body.expires_in_days)
          : 30;
        const expiresAt = new Date(
          Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
        ).toISOString();

        const maxUses =
          body.max_uses === null || body.max_uses === undefined
            ? 1
            : Number(body.max_uses);

        const token = generateSecureToken();
        const { data: tokenRow, error: insertError } = await supabaseAdmin
          .from("public_form_tokens")
          .insert({
            token,
            org_id: member.org_id,
            form_instance_id: formInstance.id,
            contact_id: body.contact_id ?? null,
            company_id: body.company_id ?? null,
            deal_id: body.deal_id ?? null,
            expires_at: expiresAt,
            max_uses: Number.isFinite(maxUses) ? maxUses : 1,
            created_by_member_id: member.id,
          })
          .select("token, expires_at, max_uses")
          .single();

        if (insertError || !tokenRow) {
          console.error("[generate_form_token] insert error", insertError);
          return createErrorResponse(500, "Could not generate form link");
        }

        const baseUrl = resolveBaseUrl(body.base_url);
        const path = `/forms/${tokenRow.token}`;
        const url = baseUrl ? `${baseUrl}${path}` : path;

        return new Response(
          JSON.stringify({
            token: tokenRow.token,
            url,
            expires_at: tokenRow.expires_at,
            max_uses: tokenRow.max_uses,
            form_instance_id: formInstance.id,
            form_name: formInstance.name,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("[generate_form_token] error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
