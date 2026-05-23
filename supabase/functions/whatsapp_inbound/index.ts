import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * WhatsApp Business webhook — SHELL ONLY.
 * Configure verify token in Settings → Communications → WhatsApp.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (req.method === "GET" && mode === "subscribe" && token && challenge) {
    // TODO: validate token against organization_messaging_settings.whatsapp_verify_token
    console.warn("[WhatsApp SHELL] Verification handshake received");
    return new Response(challenge, { status: 200, headers: corsHeaders });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    console.warn("[WhatsApp SHELL] Inbound payload:", JSON.stringify(body));
    // TODO: X-Hub-Signature-256, resolve org, insert conversation_message channel=whatsapp
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: corsHeaders,
  });
});
