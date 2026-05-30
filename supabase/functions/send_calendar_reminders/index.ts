import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  isAuthorizedFollowUpCron,
  processDueCalendarFollowUpReminders,
} from "../_shared/notifyFollowUp.ts";

type CronBody = {
  app_base_url?: string | null;
};

/**
 * Sends SMS reminders for lead follow-ups when remind_before_minutes is reached.
 *
 * Schedule every 5 minutes (Supabase Dashboard → Edge Functions → Cron, or external cron):
 * POST /functions/v1/send_calendar_reminders
 * Header: x-cron-secret: <CRON_SECRET>
 */
Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    if (!isAuthorizedFollowUpCron(req)) {
      return createErrorResponse(401, "Unauthorized");
    }

    let payload: CronBody = {};
    try {
      const text = await req.text();
      if (text.trim()) {
        payload = JSON.parse(text) as CronBody;
      }
    } catch {
      return createErrorResponse(400, "Invalid JSON body");
    }

    try {
      const { supabaseAdmin } = await import("../_shared/supabaseAdmin.ts");
      const results = await processDueCalendarFollowUpReminders(
        supabaseAdmin,
        { appBaseUrl: payload.app_base_url },
      );

      const sent = results.filter((entry) => entry.ok && entry.sent).length;
      const skipped = results.filter((entry) => entry.ok && !entry.sent).length;
      const failed = results.filter((entry) => !entry.ok).length;

      return new Response(
        JSON.stringify({
          ok: true,
          processed: results.length,
          sent,
          skipped,
          failed,
          results,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("[send_calendar_reminders] error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
