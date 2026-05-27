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
      .from("client_portal_accounts")
      .select("invitation_token, active")
      .eq("short_code", code)
      .maybeSingle();

    if (error || !data?.invitation_token) {
      return createErrorResponse(404, "Short link not found");
    }
    if (data.active === false) {
      return createErrorResponse(410, "This portal link has been disabled");
    }

    return new Response(JSON.stringify({ token: data.invitation_token }), {
      headers: {
        ...jsonCorsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[resolve_portal_short_code] error", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unexpected error",
    );
  }
});

