import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isAuthorizedClientBillingCron } from "../_shared/clientProposalBilling.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sendMarketingSms } from "../_shared/marketingSms.ts";
import { sendMarketingEmail } from "../_shared/marketingEmail.ts";

const SMS_BATCH = 20;
const EMAIL_BATCH = 25;

const refreshSmsCampaignStats = async (campaignId: number) => {
  const { data: recipients } = await supabaseAdmin
    .from("sms_campaign_recipients")
    .select("status")
    .eq("campaign_id", campaignId);

  const counts = {
    sent: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
  };

  for (const row of recipients ?? []) {
    const status = String(row.status);
    if (status === "sent" || status === "delivered" || status === "queued") {
      counts.sent += 1;
    } else if (status === "failed") {
      counts.failed += 1;
    } else if (status === "skipped") {
      counts.skipped += 1;
    } else if (status === "pending") {
      counts.pending += 1;
    }
  }

  const done = counts.pending === 0;
  await supabaseAdmin
    .from("sms_campaigns")
    .update({
      sent_count: counts.sent,
      failed_count: counts.failed,
      skipped_count: counts.skipped,
      status: done ? "sent" : "sending",
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return counts;
};

const refreshEmailCampaignStats = async (campaignId: number) => {
  const { data: recipients } = await supabaseAdmin
    .from("email_campaign_recipients")
    .select("status")
    .eq("campaign_id", campaignId);

  const counts = {
    sent: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
  };

  for (const row of recipients ?? []) {
    const status = String(row.status);
    if (status === "sent") {
      counts.sent += 1;
    } else if (status === "failed") {
      counts.failed += 1;
    } else if (status === "skipped" || status === "unsubscribed") {
      counts.skipped += 1;
    } else if (status === "pending") {
      counts.pending += 1;
    }
  }

  const done = counts.pending === 0;
  await supabaseAdmin
    .from("email_campaigns")
    .update({
      sent_count: counts.sent,
      failed_count: counts.failed,
      skipped_count: counts.skipped,
      status: done ? "sent" : "sending",
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return counts;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    if (!isAuthorizedClientBillingCron(req)) {
      return createErrorResponse(401, "Unauthorized");
    }

    try {
      const smsResults: Array<{ campaign_id: number; processed: number }> = [];
      const emailResults: Array<{ campaign_id: number; processed: number }> = [];

      const { data: smsCampaigns } = await supabaseAdmin
        .from("sms_campaigns")
        .select("id, org_id, body, include_stop_footer")
        .eq("status", "sending")
        .limit(5);

      for (const campaign of smsCampaigns ?? []) {
        const { data: recipients } = await supabaseAdmin
          .from("sms_campaign_recipients")
          .select("id, phone_e164")
          .eq("campaign_id", campaign.id)
          .eq("status", "pending")
          .limit(SMS_BATCH);

        let processed = 0;
        for (const recipient of recipients ?? []) {
          try {
            const result = await sendMarketingSms({
              orgId: Number(campaign.org_id),
              to: String(recipient.phone_e164),
              body: String(campaign.body),
              includeStopFooter: campaign.include_stop_footer !== false,
            });

            await supabaseAdmin
              .from("sms_campaign_recipients")
              .update({
                status: "sent",
                external_id: result.sid ?? null,
                sent_at: new Date().toISOString(),
              })
              .eq("id", recipient.id);
            processed += 1;
          } catch (sendError) {
            const message =
              sendError instanceof Error ? sendError.message : "Send failed";
            await supabaseAdmin
              .from("sms_campaign_recipients")
              .update({
                status: "failed",
                error_message: message,
              })
              .eq("id", recipient.id);
          }
        }

        await refreshSmsCampaignStats(Number(campaign.id));
        smsResults.push({ campaign_id: Number(campaign.id), processed });
      }

      const { data: emailCampaigns } = await supabaseAdmin
        .from("email_campaigns")
        .select("id, org_id, subject, body_html, body_text")
        .eq("status", "sending")
        .limit(5);

      for (const campaign of emailCampaigns ?? []) {
        const { data: recipients } = await supabaseAdmin
          .from("email_campaign_recipients")
          .select("id, email, unsubscribe_token")
          .eq("campaign_id", campaign.id)
          .eq("status", "pending")
          .limit(EMAIL_BATCH);

        let processed = 0;
        for (const recipient of recipients ?? []) {
          try {
            const result = await sendMarketingEmail({
              orgId: Number(campaign.org_id),
              to: String(recipient.email),
              subject: String(campaign.subject),
              bodyHtml: String(campaign.body_html),
              bodyText: campaign.body_text ? String(campaign.body_text) : null,
              unsubscribeToken: String(recipient.unsubscribe_token),
            });

            await supabaseAdmin
              .from("email_campaign_recipients")
              .update({
                status: "sent",
                external_id: result.id ?? null,
                sent_at: new Date().toISOString(),
              })
              .eq("id", recipient.id);
            processed += 1;
          } catch (sendError) {
            const message =
              sendError instanceof Error ? sendError.message : "Send failed";
            await supabaseAdmin
              .from("email_campaign_recipients")
              .update({
                status: "failed",
                error_message: message,
              })
              .eq("id", recipient.id);
          }
        }

        await refreshEmailCampaignStats(Number(campaign.id));
        emailResults.push({ campaign_id: Number(campaign.id), processed });
      }

      return new Response(
        JSON.stringify({ sms: smsResults, email: emailResults }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    } catch (error) {
      console.error("process_marketing_campaigns", error);
      const message = error instanceof Error ? error.message : "Worker failed";
      return createErrorResponse(500, message);
    }
  }),
);
