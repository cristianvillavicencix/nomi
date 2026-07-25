import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { recordEmailMarketingOptOut } from "../_shared/marketingAudience.ts";

const successHtml = (message: string) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Unsubscribed</title></head><body style="font-family:system-ui,sans-serif;padding:40px;max-width:480px;margin:0 auto;"><h1>Unsubscribed</h1><p>${message}</p></body></html>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return createErrorResponse(405, "Method not allowed");
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim();
    if (!token) {
      return new Response(successHtml("Invalid unsubscribe link."), {
        status: 400,
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    }

    const { data: recipient, error } = await supabaseAdmin
      .from("email_campaign_recipients")
      .select("id, org_id, contact_id, email, status")
      .eq("unsubscribe_token", token)
      .maybeSingle();

    if (error || !recipient) {
      return new Response(successHtml("This unsubscribe link is not valid."), {
        status: 404,
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    }

    if (recipient.status !== "unsubscribed") {
      await supabaseAdmin
        .from("email_campaign_recipients")
        .update({ status: "unsubscribed" })
        .eq("id", recipient.id);

      if (recipient.contact_id) {
        await recordEmailMarketingOptOut({
          orgId: Number(recipient.org_id),
          contactId: Number(recipient.contact_id),
          email: String(recipient.email),
          reason: "unsubscribe_link",
        });
      }
    }

    return new Response(
      successHtml("You have been unsubscribed from marketing emails."),
      {
        status: 200,
        headers: { "Content-Type": "text/html", ...corsHeaders },
      },
    );
  } catch (error) {
    console.error("marketing_unsubscribe", error);
    return new Response(successHtml("Something went wrong. Please try again."), {
      status: 500,
      headers: { "Content-Type": "text/html", ...corsHeaders },
    });
  }
});
