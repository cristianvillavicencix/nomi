import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { syncHostingerDomainsForOrg } from "../_shared/hostingerSync.ts";
import { updateHostingerSyncMetadata } from "../_shared/hostingerSettings.ts";

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
      const orgId = member?.org_id != null ? Number(member.org_id) : null;
      if (!orgId) {
        return createErrorResponse(403, "Organization not found");
      }

      try {
        const result = await syncHostingerDomainsForOrg(user, orgId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Hostinger sync failed";
        await updateHostingerSyncMetadata(orgId, {
          last_sync_error: message,
        }).catch(() => undefined);
        return createErrorResponse(400, message);
      }
    });
  }),
);
