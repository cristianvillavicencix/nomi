import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type Query = {
  code?: string | null;
  token?: string | null;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "GET" && req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      let code: string | null = null;
      let token: string | null = null;

      if (req.method === "GET") {
        const url = new URL(req.url);
        code = url.searchParams.get("code");
        token = url.searchParams.get("token");
      } else {
        const body = (await req.json().catch(() => ({}))) as Query;
        code = body.code?.trim() || null;
        token = body.token?.trim() || null;
      }

      const shortCode = code?.trim() || null;
      const longToken = token?.trim() || null;
      if (!shortCode && !longToken) {
        return createErrorResponse(400, "code or token is required");
      }

      let tokenQuery = supabaseAdmin
        .from("public_calendar_event_tokens")
        .select("token, short_code, calendar_event_id, org_id");

      if (shortCode) {
        tokenQuery = tokenQuery.eq("short_code", shortCode);
      } else {
        tokenQuery = tokenQuery.eq("token", longToken!);
      }

      const { data: tokenRow, error: tokenError } = await tokenQuery.maybeSingle();
      if (tokenError) {
        throw new Error(tokenError.message);
      }
      if (!tokenRow?.calendar_event_id) {
        return createErrorResponse(404, "Calendar link not found");
      }

      const { data: event, error: eventError } = await supabaseAdmin
        .from("calendar_events")
        .select(
          "id, title, description, event_date, event_time, duration_minutes, meeting_url, timezone, org_id",
        )
        .eq("id", tokenRow.calendar_event_id)
        .eq("org_id", tokenRow.org_id)
        .maybeSingle();

      if (eventError) {
        throw new Error(eventError.message);
      }
      if (!event?.id) {
        return createErrorResponse(404, "Meeting not found");
      }

      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("name, booking_settings")
        .eq("id", event.org_id)
        .maybeSingle();

      let timezone = event.timezone?.trim() || null;
      if (!timezone && org?.booking_settings) {
        const { normalizeBookingSettings } = await import(
          "../_shared/bookingUtils.ts"
        );
        timezone = normalizeBookingSettings(org.booking_settings).timezone_label;
      }

      return new Response(
        JSON.stringify({
          title: event.title?.trim() || "Video call",
          description: event.description ?? null,
          event_date: event.event_date,
          event_time: event.event_time,
          duration_minutes: event.duration_minutes ?? 60,
          meeting_url: event.meeting_url ?? null,
          timezone: timezone || "America/New_York",
          org_name: org?.name?.trim() || null,
          short_code: tokenRow.short_code,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("get_public_calendar_event.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
