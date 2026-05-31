import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

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

      const { data, error } = await supabaseAdmin.rpc(
        "sync_monitored_websites_for_org",
        { target_org_id: member.org_id },
      );

      if (error) {
        return createErrorResponse(500, error.message);
      }

      return new Response(
        JSON.stringify({ ok: true, synced: data ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    });
  }),
);
