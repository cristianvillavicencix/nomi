import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { isPlatformOperator } from "../_shared/billingAccess.ts";

type AuthRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }
    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }
      if (!(await isPlatformOperator(user.id))) {
        return createErrorResponse(403, "Platform operators only");
      }

      const rows: AuthRow[] = [];
      let page = 1;
      const perPage = 1000;
      for (;;) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });
        if (error) {
          return createErrorResponse(500, error.message);
        }
        const batch = data?.users ?? [];
        for (const u of batch) {
          rows.push({
            id: u.id,
            email: u.email ?? null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
            email_confirmed_at: u.email_confirmed_at ?? null,
          });
        }
        if (batch.length < perPage) break;
        page += 1;
        if (page > 50) break;
      }

      return new Response(
        JSON.stringify({ users: rows, total: rows.length }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    });
  })
);
