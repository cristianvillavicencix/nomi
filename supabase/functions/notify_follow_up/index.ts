import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  notifyFollowUpForCalendarEvent,
  type FollowUpNotificationKind,
} from "../_shared/notifyFollowUp.ts";

type NotifyBody = {
  calendar_event_id?: number;
  kind?: FollowUpNotificationKind;
  app_base_url?: string | null;
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req) => {
      let payload: NotifyBody;
      try {
        payload = (await req.json()) as NotifyBody;
      } catch {
        return createErrorResponse(400, "Invalid JSON body");
      }

      const calendarEventId = Number(payload.calendar_event_id);
      const kind = payload.kind === "reminder" ? "reminder" : "scheduled";

      if (!Number.isFinite(calendarEventId) || calendarEventId <= 0) {
        return createErrorResponse(400, "calendar_event_id is required");
      }

      const { supabaseAdmin } = await import("../_shared/supabaseAdmin.ts");
      const result = await notifyFollowUpForCalendarEvent(
        supabaseAdmin,
        calendarEventId,
        kind,
        { appBaseUrl: payload.app_base_url },
      );

      if (!result.ok) {
        return createErrorResponse(500, result.error);
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    });
  }),
);
