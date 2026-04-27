import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";

function getSetPasswordRedirectUrl(req: Request) {
  const origin =
    req.headers.get("origin") ??
    Deno.env.get("BILLING_PUBLIC_SITE_URL") ??
    "http://localhost:5173";

  return new URL("/set-password", origin).toString();
}

async function updatePassword(req: Request, user: any) {
  const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(
    user.email,
    { redirectTo: getSetPasswordRedirectUrl(req) },
  );

  if (!data || error) {
    return createErrorResponse(500, "Internal Server Error");
  }

  return new Response(
    JSON.stringify({
      data,
    }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method === "PATCH") {
          return updatePassword(req, user);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
