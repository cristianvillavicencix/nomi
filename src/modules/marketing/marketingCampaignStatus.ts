export const SMS_CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  building: "Building audience",
  ready: "Ready to send",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const EMAIL_CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  ...SMS_CAMPAIGN_STATUS_LABELS,
};

export const formatCampaignStatus = (
  status: string,
  labels: Record<string, string> = SMS_CAMPAIGN_STATUS_LABELS,
) => labels[status] ?? status;
