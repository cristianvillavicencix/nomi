import { CONTACT_STATUS_CHOICES } from "@/modules/constants/contactStatus";
import type { MarketingAudienceFilter } from "@/modules/types";

const statusLabel = (value: string) =>
  CONTACT_STATUS_CHOICES.find((c) => c.value === value)?.label ?? value;

export const summarizeAudienceFilter = (
  filter: MarketingAudienceFilter | undefined,
  channel: "sms" | "email",
): string[] => {
  const lines: string[] = [];
  const statuses = filter?.statuses?.filter(Boolean) ?? [];
  if (statuses.length > 0) {
    lines.push(`Status: ${statuses.map(statusLabel).join(", ")}`);
  } else {
    lines.push("Status: all contacts");
  }

  const tags = filter?.tags?.filter(Boolean) ?? [];
  if (tags.length > 0) {
    lines.push(`Tags: ${tags.join(", ")}`);
  }

  const requireOptIn =
    channel === "sms"
      ? filter?.require_sms_opt_in !== false
      : filter?.require_email_opt_in !== false;

  lines.push(
    requireOptIn
      ? `Only ${channel === "sms" ? "SMS" : "email"} marketing opt-in`
      : "Opt-in not required (use with caution)",
  );

  return lines;
};
