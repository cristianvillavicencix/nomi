import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";

/** WhatsApp outbound — SHELL ONLY until credentials are configured. */
Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async () =>
      new Response(
        JSON.stringify({
          error:
            "WhatsApp Business not configured. Add credentials in Settings → Communications → WhatsApp.",
          code: "WHATSAPP_NOT_CONFIGURED",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      ),
    );
  }),
);
