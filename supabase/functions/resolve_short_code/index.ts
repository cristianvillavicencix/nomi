import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const jsonCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonCorsHeaders });
  }

  if (req.method !== "GET") {
    return createErrorResponse(405, "Method not allowed");
  }

  try {
    const url = new URL(req.url);
    const code = String(url.searchParams.get("code") ?? "").trim();
    if (!code) {
      return createErrorResponse(400, "Missing short code");
    }

    const { data, error } = await supabaseAdmin
      .from("public_form_tokens")
      .select("token, expires_at, max_uses, uses_count")
      .eq("short_code", code)
      .maybeSingle();

    if (error || !data?.token) {
      return createErrorResponse(404, "Short link not found");
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return createErrorResponse(410, "This form link has expired");
    }

    if (data.max_uses != null && data.uses_count >= data.max_uses) {
      return createErrorResponse(410, "This form link has reached its limit");
    }

    return new Response(JSON.stringify({ token: data.token }), {
      headers: {
        ...jsonCorsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[resolve_short_code] error", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unexpected error",
    );
  }
});
