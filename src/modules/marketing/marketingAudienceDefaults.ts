import type { MarketingAudienceFilter } from "@/modules/types";

export const DEFAULT_SMS_AUDIENCE_FILTER: MarketingAudienceFilter = {
  statuses: ["client"],
  require_sms_opt_in: true,
};

export const DEFAULT_EMAIL_AUDIENCE_FILTER: MarketingAudienceFilter = {
  statuses: ["client"],
  require_email_opt_in: true,
};
