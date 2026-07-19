import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  isAuthorizedFollowUpCron,
  processDueCalendarFollowUpReminders,
} from "../_shared/notifyFollowUp.ts";
import { processDueBookingGuestReminders } from "../_shared/notifyBooking.ts";
import { processDueMeetingReminders } from "../_shared/notifyMeeting.ts";

type CronBody = {
  app_base_url?: string | null;
};

/**
 * Sends SMS reminders for calendar follow-ups and guest booking appointments.
 *
 * Schedule every 5 minutes via pg_cron (migration send_calendar_reminders_every_5m)
 * or external cron:
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
      const hostResults = await processDueCalendarFollowUpReminders(
        supabaseAdmin,
        { appBaseUrl: payload.app_base_url },
      );
      const guestResults = await processDueBookingGuestReminders(supabaseAdmin);
      const meetingResults = await processDueMeetingReminders(supabaseAdmin, {
        appBaseUrl: payload.app_base_url,
      });

      const sent =
        hostResults.filter((entry) => entry.ok && entry.sent).length +
        guestResults.filter((entry) => entry.sent).length +
        meetingResults.filter((entry) => entry.sent).length;
      const skipped =
        hostResults.filter((entry) => entry.ok && !entry.sent).length +
        guestResults.filter((entry) => !entry.sent).length +
        meetingResults.filter((entry) => !entry.sent).length;
      const failed = hostResults.filter((entry) => !entry.ok).length;

      return new Response(
        JSON.stringify({
          ok: true,
          processed:
            hostResults.length + guestResults.length + meetingResults.length,
          sent,
          skipped,
          failed,
          host_results: hostResults,
          guest_results: guestResults,
          meeting_results: meetingResults,
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
