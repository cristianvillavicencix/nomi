export type ClientServiceType = "website" | "xactimate" | "both";

export type ClientServiceTypeInput = {
  dealCount: number;
  ticketCount: number;
  invoiceCount: number;
};

export const CLIENT_SERVICE_TYPE_LABELS: Record<ClientServiceType, string> = {
  website: "Website",
  xactimate: "Xactimate",
  both: "Both",
};

/**
 * Derives client service-type badge from activity counts on the company show page.
 * Uses total deals (all pipeline stages), not open-deal count only.
 */
export const deriveClientServiceType = (
  input: ClientServiceTypeInput,
): ClientServiceType | null => {
  const hasWebsite = input.dealCount > 0;
  const hasXactimate = input.ticketCount > 0 || input.invoiceCount > 0;

  if (hasWebsite && hasXactimate) return "both";
  if (hasWebsite) return "website";
  if (hasXactimate) return "xactimate";
  return null;
};
