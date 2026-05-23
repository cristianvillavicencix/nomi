import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";

/** Twilio Voice status callbacks — SHELL ONLY. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const body = await req.formData();
  console.log(
    "[Voice SHELL] Status callback:",
    Object.fromEntries(body.entries()),
  );

  // TODO: validate Twilio signature, upsert voice_calls by CallSid

  return new Response("OK", { status: 200, headers: corsHeaders });
});
