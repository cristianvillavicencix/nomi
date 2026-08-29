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

const WEBSITE_SERVICE_TOKENS = [
  "website",
  "sitio web",
  "web site",
  "seo",
  "google ads",
  "branding",
  "redes sociales",
  "social media",
] as const;

const XACTIMATE_SERVICE_TOKENS = ["xactimate", "xact"] as const;

const tokenizeInterestedServices = (value?: string | null): string[] => {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
};

/** Parse Website / Xactimate intent from contact.interested_service text. */
export const parseInterestedServiceType = (
  interestedService?: string | null,
): ClientServiceType | null => {
  const tokens = tokenizeInterestedServices(interestedService);
  if (tokens.length === 0) return null;

  let hasWebsite = false;
  let hasXactimate = false;

  for (const token of tokens) {
    if (XACTIMATE_SERVICE_TOKENS.some((t) => token.includes(t))) {
      hasXactimate = true;
      continue;
    }
    if (WEBSITE_SERVICE_TOKENS.some((t) => token.includes(t))) {
      hasWebsite = true;
    }
  }

  if (hasWebsite && hasXactimate) return "both";
  if (hasWebsite) return "website";
  if (hasXactimate) return "xactimate";
  return null;
};

const mergeServiceTypes = (
  a: ClientServiceType | null,
  b: ClientServiceType | null,
): ClientServiceType | null => {
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  if (a === "both" || b === "both") return "both";
  return "both";
};

/**
 * Contact classification: declared interest + same activity signals as accounts
 * (deals → Website, tickets/invoices → Xactimate).
 */
export const deriveContactServiceType = (input: {
  interestedService?: string | null;
  dealCount: number;
  ticketCount: number;
  invoiceCount: number;
}): ClientServiceType | null =>
  mergeServiceTypes(
    parseInterestedServiceType(input.interestedService),
    deriveClientServiceType({
      dealCount: input.dealCount,
      ticketCount: input.ticketCount,
      invoiceCount: input.invoiceCount,
    }),
  );

export const getServiceTypeBadgeLabels = (
  serviceType: ClientServiceType | null | undefined,
): string[] => {
  if (!serviceType) return [];
  if (serviceType === "both") {
    return [
      CLIENT_SERVICE_TYPE_LABELS.website,
      CLIENT_SERVICE_TYPE_LABELS.xactimate,
    ];
  }
  return [CLIENT_SERVICE_TYPE_LABELS[serviceType]];
};

/** Human-readable list of interested services from stored comma-separated text. */
export const formatInterestedServicesLabel = (
  interestedService?: string | null,
): string | null => {
  const parts = interestedService
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts?.length) return null;
  return parts
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "sitio web" || lower === "website") return "Website";
      if (lower === "redes sociales") return "Social media";
      if (lower === "otro") return "Other";
      return part;
    })
    .join(", ");
};
