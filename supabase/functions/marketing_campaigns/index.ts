import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  buildEmailCampaignRecipients,
  buildSmsCampaignRecipients,
  type MarketingAudienceFilter,
} from "../_shared/marketingAudience.ts";

type Body = {
  action?: "prepare_sms_audience" | "prepare_email_audience" | "start_sms_send" | "start_email_send" | "cancel_sms" | "cancel_email";
  campaign_id?: number;
  channel?: "sms" | "email";
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

      const member = await getUserOrganizationMember(user);
      const orgId = member?.org_id != null ? Number(member.org_id) : null;
      const memberId = member?.id != null ? Number(member.id) : null;
      if (!orgId || !memberId) {
        return createErrorResponse(403, "Organization not found");
      }

      try {
        const payload = (await req.json()) as Body;
        const action = payload.action;
        const campaignId = Number(payload.campaign_id);
        if (!action || !Number.isFinite(campaignId) || campaignId <= 0) {
          return createErrorResponse(400, "Invalid request");
        }

        const canManage = hasMemberCapability(
          member,
          "marketing.campaigns.manage",
        );
        const canSend = hasMemberCapability(member, "marketing.campaigns.send");

        if (action === "prepare_sms_audience") {
          if (!canManage) {
            return createErrorResponse(403, "Forbidden");
          }

          const { data: campaign, error } = await supabaseAdmin
            .from("sms_campaigns")
            .select("id, org_id, status, audience_filter")
            .eq("id", campaignId)
            .eq("org_id", orgId)
            .maybeSingle();

          if (error || !campaign) {
            return createErrorResponse(404, "Campaign not found");
          }

          if (!["draft", "ready", "building"].includes(campaign.status)) {
            return createErrorResponse(400, "Campaign cannot be rebuilt");
          }

          await supabaseAdmin
            .from("sms_campaigns")
            .update({ status: "building", updated_at: new Date().toISOString() })
            .eq("id", campaignId);

          const result = await buildSmsCampaignRecipients({
            orgId,
            campaignId,
            audienceFilter: (campaign.audience_filter ??
              {}) as MarketingAudienceFilter,
          });

          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "prepare_email_audience") {
          if (!canManage) {
            return createErrorResponse(403, "Forbidden");
          }

          const { data: campaign, error } = await supabaseAdmin
            .from("email_campaigns")
            .select("id, org_id, status, audience_filter")
            .eq("id", campaignId)
            .eq("org_id", orgId)
            .maybeSingle();

          if (error || !campaign) {
            return createErrorResponse(404, "Campaign not found");
          }

          if (!["draft", "ready", "building"].includes(campaign.status)) {
            return createErrorResponse(400, "Campaign cannot be rebuilt");
          }

          await supabaseAdmin
            .from("email_campaigns")
            .update({ status: "building", updated_at: new Date().toISOString() })
            .eq("id", campaignId);

          const result = await buildEmailCampaignRecipients({
            orgId,
            campaignId,
            audienceFilter: (campaign.audience_filter ??
              {}) as MarketingAudienceFilter,
          });

          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "start_sms_send") {
          if (!canSend) {
            return createErrorResponse(403, "Forbidden");
          }

          const { data: campaign, error } = await supabaseAdmin
            .from("sms_campaigns")
            .select("id, status, recipient_count")
            .eq("id", campaignId)
            .eq("org_id", orgId)
            .maybeSingle();

          if (error || !campaign) {
            return createErrorResponse(404, "Campaign not found");
          }

          if (campaign.status !== "ready") {
            return createErrorResponse(400, "Campaign is not ready to send");
          }

          if ((campaign.recipient_count ?? 0) <= 0) {
            return createErrorResponse(400, "No recipients");
          }

          await supabaseAdmin
            .from("sms_campaigns")
            .update({
              status: "sending",
              started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", campaignId);

          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "start_email_send") {
          if (!canSend) {
            return createErrorResponse(403, "Forbidden");
          }

          const { data: campaign, error } = await supabaseAdmin
            .from("email_campaigns")
            .select("id, status, recipient_count")
            .eq("id", campaignId)
            .eq("org_id", orgId)
            .maybeSingle();

          if (error || !campaign) {
            return createErrorResponse(404, "Campaign not found");
          }

          if (campaign.status !== "ready") {
            return createErrorResponse(400, "Campaign is not ready to send");
          }

          if ((campaign.recipient_count ?? 0) <= 0) {
            return createErrorResponse(400, "No recipients");
          }

          await supabaseAdmin
            .from("email_campaigns")
            .update({
              status: "sending",
              started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", campaignId);

          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "cancel_sms") {
          if (!canManage) {
            return createErrorResponse(403, "Forbidden");
          }

          await supabaseAdmin
            .from("sms_campaigns")
            .update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", campaignId)
            .eq("org_id", orgId)
            .in("status", ["draft", "ready", "building", "sending"]);

          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "cancel_email") {
          if (!canManage) {
            return createErrorResponse(403, "Forbidden");
          }

          await supabaseAdmin
            .from("email_campaigns")
            .update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", campaignId)
            .eq("org_id", orgId)
            .in("status", ["draft", "ready", "building", "sending"]);

          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        return createErrorResponse(400, "Unknown action");
      } catch (error) {
        console.error("marketing_campaigns", error);
        const message =
          error instanceof Error ? error.message : "Request failed";
        return createErrorResponse(500, message);
      }
    });
  }),
);
