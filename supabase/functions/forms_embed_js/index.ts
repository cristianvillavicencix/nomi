import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const scriptCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const resolveAppOrigin = (req: Request) => {
  const envUrl =
    Deno.env.get("PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("VITE_PUBLIC_APP_URL")?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const origin = req.headers.get("origin")?.trim();
  if (origin) return origin.replace(/\/$/, "");
  return "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: scriptCorsHeaders });
  }

  if (req.method !== "GET") {
    return createErrorResponse(405, "Method not allowed");
  }

  const url = new URL(req.url);
  const token = String(url.searchParams.get("token") ?? "").trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return createErrorResponse(400, "Invalid form token");
  }

  const appOrigin = resolveAppOrigin(req);
  const embedUrl = appOrigin
    ? `${appOrigin}/forms/${token}?embed=1`
    : `/forms/${token}?embed=1`;
  const containerId = `nomi-form-${token}`;

  const script = `(function(){
  var containerId = ${JSON.stringify(containerId)};
  var embedUrl = ${JSON.stringify(embedUrl)};
  var container = document.getElementById(containerId);
  if (!container) {
    console.error("Nomi Forms: container #" + containerId + " not found");
    return;
  }
  var iframe = document.createElement("iframe");
  iframe.src = embedUrl;
  iframe.title = "Form";
  iframe.style.width = "100%";
  iframe.style.border = "none";
  iframe.style.minHeight = "600px";
  iframe.setAttribute("allow", "clipboard-write");
  container.appendChild(iframe);
  window.addEventListener("message", function(event) {
    if (!event.data || event.data.type !== "nomi-form-resize") return;
    if (typeof event.data.height === "number" && event.data.height > 0) {
      iframe.style.height = event.data.height + "px";
    }
  });
})();`;

  return new Response(script, {
    headers: {
      ...scriptCorsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});
