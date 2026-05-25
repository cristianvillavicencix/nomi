import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type RecordEventBody = {
  token?: string;
  event_type?: string;
  field_key?: string;
};

const ALLOWED_EVENTS = new Set([
  "started",
  "field_completed",
  "field_focused",
  "abandoned",
]);

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as RecordEventBody;
      const token = String(body.token ?? "").trim();
      const eventType = String(body.event_type ?? "").trim();

      if (!token) {
        return createErrorResponse(400, "Missing form token");
      }

      if (!ALLOWED_EVENTS.has(eventType)) {
        return createErrorResponse(400, "Invalid event type");
      }

      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from("public_form_tokens")
        .select("org_id, form_instance_id, expires_at, max_uses, uses_count")
        .eq("token", token)
        .single();

      if (tokenError || !tokenData) {
        return createErrorResponse(404, "Invalid or expired form link");
      }

      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        return createErrorResponse(410, "This form link has expired");
      }

      if (
        tokenData.max_uses != null &&
        tokenData.uses_count >= tokenData.max_uses
      ) {
        return createErrorResponse(
          410,
          "This form link has reached its submission limit",
        );
      }

      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const userAgent = req.headers.get("user-agent");

      const { error: insertError } = await supabaseAdmin
        .from("form_submission_events")
        .insert({
          org_id: tokenData.org_id,
          form_instance_id: tokenData.form_instance_id,
          event_type: eventType,
          field_key: body.field_key?.trim() || null,
          ip_address: clientIp,
          user_agent: userAgent,
        });

      if (insertError) {
        console.error("record_form_event.insert", insertError);
        return createErrorResponse(500, "Failed to record event");
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("record_form_event.error", error);
      return createErrorResponse(500, "Unexpected error");
    }
  }),
);
