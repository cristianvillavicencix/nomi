import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { createClient } from "jsr:@supabase/supabase-js@2";

const resolveAdminKey = () => {
  const sbSecret = Deno.env.get("SB_SECRET_KEY");
  if (sbSecret && !sbSecret.includes("REPLACE_WITH_LOCAL_DEV_SECRET")) {
    return sbSecret;
  }

  return (
    Deno.env.get("SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SERVICE_ROLE_KEY") ??
    ""
  );
};

export const supabaseAdmin: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  resolveAdminKey(),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
