import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";

function getSetPasswordRedirectUrl(req: Request) {
  const origin =
    req.headers.get("origin") ??
    Deno.env.get("BILLING_PUBLIC_SITE_URL") ??
    "https://www.nomicrm.com";

  return new URL("/set-password", origin).toString();
}

async function updatePassword(req: Request, user: { email?: string }) {
  const email = user.email?.trim();
  if (!email) {
    return createErrorResponse(400, "User email is missing");
  }

  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: getSetPasswordRedirectUrl(req),
  });

  if (error) {
    console.error("update_password resetPasswordForEmail", error);
    const status = error.status === 429 ? 429 : 400;
    return createErrorResponse(status, error.message);
  }

  return new Response(JSON.stringify({ data: true }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
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
