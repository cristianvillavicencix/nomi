import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { normalizeMonitorUrl } from "../_shared/websiteMonitor.ts";

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (_req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      const member = await getUserOrganizationMember(user);
      if (!member?.org_id) {
        return createErrorResponse(403, "Forbidden");
      }

      let payload: {
        url?: string;
        display_name?: string;
        notes?: string;
        company_id?: number | null;
        deal_id?: number | null;
        check_paths?: string[];
      };
      try {
        payload = (await req.json()) as typeof payload;
      } catch {
        return createErrorResponse(400, "Invalid JSON body");
      }

      const normalizedUrl = normalizeMonitorUrl(payload.url);
      if (!normalizedUrl) {
        return createErrorResponse(400, "Valid url is required");
      }

      const checkPaths = (payload.check_paths ?? ["/"])
        .map((path) => path.trim())
        .filter(Boolean)
        .slice(0, 6);

      const { data, error } = await supabaseAdmin
        .from("monitored_websites")
        .insert({
          org_id: member.org_id,
          url: normalizedUrl,
          display_name: payload.display_name?.trim() || null,
          notes: payload.notes?.trim() || null,
          company_id: payload.company_id ?? null,
          deal_id: payload.deal_id ?? null,
          source: payload.company_id ? "company" : "manual",
          is_enabled: true,
          check_paths: checkPaths.length ? checkPaths : ["/"],
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          return createErrorResponse(409, "This URL is already monitored");
        }
        return createErrorResponse(500, error.message);
      }

      return new Response(
        JSON.stringify({ ok: true, id: data.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    });
  }),
);
