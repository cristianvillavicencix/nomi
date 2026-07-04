import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  loadOrgTicketWorkspaceSettings,
  saveOrgTicketWorkspaceSettings,
} from "../_shared/ticketWorkspaceSettings.ts";

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
      const { data: orgs, error } = await supabaseAdmin
        .from("organizations")
        .select("id, ticket_settings");

      if (error?.message?.includes("ticket_settings")) {
        return new Response(JSON.stringify({ ok: true, closed: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (error) throw new Error(error.message);

      let closed = 0;
      const now = Date.now();

      for (const org of orgs ?? []) {
        const settings = await loadOrgTicketWorkspaceSettings(Number(org.id));
        const days = settings.auto_close_resolved_days;
        if (!days || days <= 0) continue;

        const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
        const { data: stale, error: staleError } = await supabaseAdmin
          .from("tickets")
          .select("id")
          .eq("org_id", org.id)
          .eq("status", "resolved")
          .lt("updated_at", cutoff)
          .is("merged_into_ticket_id", null);

        if (staleError) throw new Error(staleError.message);
        if (!stale?.length) continue;

        for (const row of stale) {
          await supabaseAdmin.from("ticket_messages").insert({
            ticket_id: row.id,
            body: "Auto-closed after configured inactivity on a resolved ticket.",
            direction: "internal",
            created_at: new Date().toISOString(),
          });
        }

        const ids = stale.map((row) => row.id);
        const { error: archiveError } = await supabaseAdmin
          .from("tickets")
          .update({
            status: "resolved",
            updated_at: new Date().toISOString(),
          })
          .in("id", ids);

        if (archiveError) throw new Error(archiveError.message);
        closed += ids.length;
      }

      return new Response(JSON.stringify({ ok: true, closed }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Automation failed",
      );
    }
  }),
);
