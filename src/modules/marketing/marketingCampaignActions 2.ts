import {
  invokeEdgeFunction,
  readEdgeFunctionErrorMessage,
} from "@/components/atomic-crm/providers/supabase/invokeEdgeFunction";

export type PrepareAudienceResult = {
  total: number;
  pending: number;
  skipped: number;
  matched_contacts?: number;
  skipped_suppressed?: number;
  skipped_not_opted_in?: number;
};

export type AudienceEstimateResult = PrepareAudienceResult;

export const marketingCampaignActions = {
  async estimateSmsAudience(
    audienceFilter: import("@/modules/types").MarketingAudienceFilter,
    campaignId?: number,
  ) {
    const { data, error } = await invokeEdgeFunction<AudienceEstimateResult>(
      "marketing_campaigns",
      {
        method: "POST",
        body: {
          action: "estimate_sms_audience",
          audience_filter: audienceFilter,
          ...(campaignId ? { campaign_id: campaignId } : {}),
        },
      },
    );
    if (error) {
      throw new Error(readEdgeFunctionErrorMessage(error));
    }
    if (!data) {
      throw new Error("Failed to estimate SMS audience");
    }
    return data;
  },

  async estimateEmailAudience(
    audienceFilter: import("@/modules/types").MarketingAudienceFilter,
    campaignId?: number,
  ) {
    const { data, error } = await invokeEdgeFunction<AudienceEstimateResult>(
      "marketing_campaigns",
      {
        method: "POST",
        body: {
          action: "estimate_email_audience",
          audience_filter: audienceFilter,
          ...(campaignId ? { campaign_id: campaignId } : {}),
        },
      },
    );
    if (error) {
      throw new Error(readEdgeFunctionErrorMessage(error));
    }
    if (!data) {
      throw new Error("Failed to estimate email audience");
    }
    return data;
  },

  async prepareSmsAudience(campaignId: number) {
    const { data, error } = await invokeEdgeFunction<PrepareAudienceResult>(
      "marketing_campaigns",
      {
        method: "POST",
        body: { action: "prepare_sms_audience", campaign_id: campaignId },
      },
    );
    if (error) {
      throw new Error(readEdgeFunctionErrorMessage(error));
    }
    if (!data) {
      throw new Error("Failed to build SMS audience");
    }
    return data;
  },

  async prepareEmailAudience(campaignId: number) {
    const { data, error } = await invokeEdgeFunction<PrepareAudienceResult>(
      "marketing_campaigns",
      {
        method: "POST",
        body: { action: "prepare_email_audience", campaign_id: campaignId },
      },
    );
    if (error) {
      throw new Error(readEdgeFunctionErrorMessage(error));
    }
    if (!data) {
      throw new Error("Failed to build email audience");
    }
    return data;
  },

  async startSmsSend(campaignId: number) {
    const { error } = await invokeEdgeFunction("marketing_campaigns", {
      method: "POST",
      body: { action: "start_sms_send", campaign_id: campaignId },
    });
    if (error) {
      throw new Error(readEdgeFunctionErrorMessage(error));
    }
  },

  async startEmailSend(campaignId: number) {
    const { error } = await invokeEdgeFunction("marketing_campaigns", {
      method: "POST",
      body: { action: "start_email_send", campaign_id: campaignId },
    });
    if (error) {
      throw new Error(readEdgeFunctionErrorMessage(error));
    }
  },

  async cancelSmsCampaign(campaignId: number) {
    const { error } = await invokeEdgeFunction("marketing_campaigns", {
      method: "POST",
      body: { action: "cancel_sms", campaign_id: campaignId },
    });
    if (error) {
      throw new Error(readEdgeFunctionErrorMessage(error));
    }
  },

  async cancelEmailCampaign(campaignId: number) {
    const { error } = await invokeEdgeFunction("marketing_campaigns", {
      method: "POST",
      body: { action: "cancel_email", campaign_id: campaignId },
    });
    if (error) {
      throw new Error(readEdgeFunctionErrorMessage(error));
    }
  },
};
