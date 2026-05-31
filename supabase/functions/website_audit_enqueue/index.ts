import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { enqueueWebsiteAudit } from "../_shared/websiteAuditWorker.ts";

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

      let payload: { monitored_website_id?: number; strategy?: string };
      try {
        payload = (await req.json()) as typeof payload;
      } catch {
        return createErrorResponse(400, "Invalid JSON body");
      }

      const siteId = Number(payload.monitored_website_id);
      if (!Number.isFinite(siteId) || siteId <= 0) {
        return createErrorResponse(400, "monitored_website_id is required");
      }

      const { data: site, error: siteError } = await supabaseAdmin
        .from("monitored_websites")
        .select("id, org_id, url, is_enabled")
        .eq("id", siteId)
        .eq("org_id", member.org_id)
        .maybeSingle();

      if (siteError) {
        return createErrorResponse(500, siteError.message);
      }
      if (!site) {
        return createErrorResponse(404, "Website not found");
      }

      try {
        const result = await enqueueWebsiteAudit(supabaseAdmin, {
          orgId: member.org_id,
          siteId,
          siteUrl: site.url,
          memberId: member.id,
        });

        return new Response(
          JSON.stringify({
            ok: true,
            reused: result.reused,
            audit: result.audit,
            worker: "worker" in result ? result.worker : { pushed: true },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Enqueue failed";
        return createErrorResponse(500, message);
      }
    });
  }),
);
