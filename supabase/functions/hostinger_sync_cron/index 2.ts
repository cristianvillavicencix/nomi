import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { syncHostingerDomainsForOrg } from "../_shared/hostingerSync.ts";
import { updateHostingerSyncMetadata } from "../_shared/hostingerSettings.ts";

const authorizeCron = (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET")?.trim();
  if (!cronSecret) return true;
  const header = req.headers.get("x-cron-secret")?.trim();
  const auth = req.headers.get("authorization")?.trim();
  return header === cronSecret || auth === `Bearer ${cronSecret}`;
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }
    if (!authorizeCron(req)) {
      return createErrorResponse(401, "Unauthorized");
    }

    try {
      const { data: settingsRows, error } = await supabaseAdmin
        .from("organization_hostinger_settings")
        .select("org_id")
        .not("api_token_encrypted", "is", null)
        .eq("weekly_sync_enabled", true);

      if (error) {
        throw new Error(error.message ?? "Failed to load Hostinger settings");
      }

      let syncedOrgs = 0;
      let syncedDomains = 0;
      const failures: Array<{ org_id: number; message: string }> = [];

      for (const row of settingsRows ?? []) {
        const orgId = Number(row.org_id);
        if (!orgId) continue;

        try {
          const result = await syncHostingerDomainsForOrg(null, orgId);
          syncedOrgs += 1;
          syncedDomains += result.synced ?? 0;
        } catch (syncError) {
          const message = syncError instanceof Error
            ? syncError.message
            : "Hostinger sync failed";
          failures.push({ org_id: orgId, message });
          await updateHostingerSyncMetadata(orgId, {
            last_sync_error: message,
          }).catch(() => undefined);
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          synced_orgs: syncedOrgs,
          synced_domains: syncedDomains,
          failures,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Hostinger cron sync failed";
      return createErrorResponse(500, message);
    }
  }),
);
