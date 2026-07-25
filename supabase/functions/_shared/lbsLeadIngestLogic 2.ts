import { normalizeUsPhoneToE164 } from "./phone.ts";

export const LBS_LEAD_SOURCES = [
  "lbs-unlock",
  "lbs-referral",
  "lbs-contact",
  "lbs-quote",
] as const;

export type LbsLeadSource = (typeof LBS_LEAD_SOURCES)[number];

export type LbsLeadPayload = {
  source?: string;
  receivedAt?: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  businessName?: string;
  website?: string;
  address?: string;
  placeId?: string;
  mapsUrl?: string;
  phone?: string;
  email?: string;
  primaryCategory?: string;
  toolKey?: string;
  toolLabel?: string;
  interestedService?: string;
  notes?: string;
  reportLines?: string[];
  referidor?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  referido?: {
    name?: string;
    business?: string;
    contact?: string;
    serviceLabel?: string;
  };
};

export type NormalizedLbsLead = {
  source: LbsLeadSource;
  businessName: string;
  website: string | null;
  address: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  leadSource: "Referido" | "WebSite Visit";
  interestedService: string | null;
  background: string;
  sector: string | null;
  referredByContactId: number | null;
  shouldCreateDeal: boolean;
  dealName: string;
  dealDescription: string;
};

const trimOrNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const normalizeWebsite = (website?: string | null) => {
  const trimmed = website?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
};

export const normalizeWebsiteHost = (website?: string | null) => {
  const normalized = normalizeWebsite(website);
  if (!normalized) return null;
  try {
    return new URL(normalized).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return normalized
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .trim() || null;
  }
};

export const splitPersonName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "Lead", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
};

export const mapPrimaryCategoryToSector = (category?: string | null) => {
  const value = category?.trim().toLowerCase() ?? "";
  if (!value) return null;
  if (value.includes("roof")) return "roofing";
  if (value.includes("siding")) return "siding";
  if (value.includes("gutter")) return "gutters";
  if (value.includes("window")) return "windows";
  if (value.includes("paint")) return "painting";
  if (value.includes("landscap")) return "landscaping";
  if (value.includes("hvac")) return "hvac";
  if (value.includes("plumb")) return "plumbing";
  if (value.includes("electric")) return "electrical";
  if (value.includes("remodel")) return "remodeling";
  if (value.includes("clean")) return "cleaning";
  return null;
};

const appendBackgroundLine = (
  lines: string[],
  label: string,
  value?: string | null,
) => {
  const trimmed = value?.trim();
  if (trimmed) lines.push(`${label}: ${trimmed}`);
};

export const buildLeadBackground = (
  payload: LbsLeadPayload,
  extraLines: string[] = [],
) => {
  const lines: string[] = [...extraLines];
  const notes = trimOrNull(payload.notes);
  if (notes) lines.push(notes);

  for (const line of payload.reportLines ?? []) {
    const trimmed = line?.trim();
    if (trimmed) lines.push(`- ${trimmed}`);
  }

  appendBackgroundLine(lines, "Tool", payload.toolLabel);
  appendBackgroundLine(lines, "Tool key", payload.toolKey);
  appendBackgroundLine(lines, "Source", payload.source);
  appendBackgroundLine(lines, "Place ID", payload.placeId);
  appendBackgroundLine(lines, "Maps", payload.mapsUrl);
  appendBackgroundLine(lines, "Received", payload.receivedAt);

  return lines.join("\n").trim();
};

export const mergeBackground = (
  existing: string | null | undefined,
  incoming: string,
) => {
  const current = existing?.trim() ?? "";
  if (!incoming) return current;
  if (!current) return incoming;
  if (current.includes(incoming)) return current;
  return `${current}\n\n${incoming}`.trim();
};

export const formatPhoneForStorage = (phone?: string | null) => {
  const trimmed = trimOrNull(phone);
  if (!trimmed) return null;
  return normalizeUsPhoneToE164(trimmed) ?? trimmed;
};

const resolveReferralContactEmail = (referido?: LbsLeadPayload["referido"]) => {
  const contactField = trimOrNull(referido?.contact);
  if (contactField && isEmail(contactField)) return contactField.toLowerCase();
  return null;
};

export const validateLbsLeadPayload = (
  payload: LbsLeadPayload,
): { ok: true } | { ok: false; message: string } => {
  const source = trimOrNull(payload.source);
  if (!source || !LBS_LEAD_SOURCES.includes(source as LbsLeadSource)) {
    return { ok: false, message: "Invalid or missing source" };
  }

  const isReferral = source === "lbs-referral";

  const businessName = isReferral
    ? trimOrNull(payload.referido?.business) ??
      trimOrNull(payload.businessName)
    : trimOrNull(payload.businessName) ?? trimOrNull(payload.referido?.business);

  const contactName = isReferral
    ? trimOrNull(payload.referido?.name) ??
      trimOrNull(payload.contact?.name)
    : trimOrNull(payload.contact?.name) ?? trimOrNull(payload.referido?.name);

  if (!businessName && !contactName) {
    return {
      ok: false,
      message: "contact.name, businessName, or referido.business is required",
    };
  }

  const contactEmail = isReferral
    ? resolveReferralContactEmail(payload.referido) ??
      trimOrNull(payload.contact?.email)?.toLowerCase() ??
      trimOrNull(payload.email)?.toLowerCase()
    : trimOrNull(payload.contact?.email)?.toLowerCase() ??
      trimOrNull(payload.email)?.toLowerCase() ??
      resolveReferralContactEmail(payload.referido);

  const contactPhone = isReferral
    ? formatPhoneForStorage(payload.contact?.phone) ??
      formatPhoneForStorage(payload.phone)
    : formatPhoneForStorage(payload.contact?.phone) ??
      formatPhoneForStorage(payload.phone) ??
      formatPhoneForStorage(payload.referido?.contact);

  if (!contactEmail && !contactPhone) {
    return {
      ok: false,
      message: "Phone or email is required on contact or referido",
    };
  }

  return { ok: true };
};

export const normalizeLbsLeadPayload = (
  payload: LbsLeadPayload,
): NormalizedLbsLead => {
  const source = trimOrNull(payload.source) as LbsLeadSource;
  const isReferral = source === "lbs-referral";

  const businessName =
    (isReferral
      ? trimOrNull(payload.referido?.business) ??
        trimOrNull(payload.businessName)
      : trimOrNull(payload.businessName) ??
        trimOrNull(payload.referido?.business)) ?? "Unknown business";

  const contactName =
    (isReferral
      ? trimOrNull(payload.referido?.name) ??
        trimOrNull(payload.contact?.name)
      : trimOrNull(payload.contact?.name) ??
        trimOrNull(payload.referido?.name)) ?? businessName;

  const { first_name, last_name } = splitPersonName(contactName);

  const contactEmail = isReferral
    ? resolveReferralContactEmail(payload.referido) ??
      trimOrNull(payload.contact?.email)?.toLowerCase() ??
      trimOrNull(payload.email)?.toLowerCase()
    : trimOrNull(payload.contact?.email)?.toLowerCase() ??
      trimOrNull(payload.email)?.toLowerCase() ??
      resolveReferralContactEmail(payload.referido);

  const contactPhone = isReferral
    ? formatPhoneForStorage(payload.contact?.phone) ??
      formatPhoneForStorage(payload.phone)
    : formatPhoneForStorage(payload.contact?.phone) ??
      formatPhoneForStorage(payload.phone);

  const referralLines: string[] = [];
  if (isReferral && payload.referidor) {
    appendBackgroundLine(referralLines, "Referrer name", payload.referidor.name);
    appendBackgroundLine(referralLines, "Referrer email", payload.referidor.email);
    appendBackgroundLine(referralLines, "Referrer phone", payload.referidor.phone);
    if (payload.referido?.serviceLabel) {
      appendBackgroundLine(
        referralLines,
        "Requested service",
        payload.referido.serviceLabel,
      );
    }
  }

  const background = buildLeadBackground(payload, referralLines);
  const interestedService =
    trimOrNull(payload.interestedService) ??
    trimOrNull(payload.referido?.serviceLabel) ??
    null;

  const shouldCreateDeal = false;
  const dealName =
    businessName ||
    trimOrNull(payload.toolLabel) ||
    `Lead from ${source}`;

  return {
    source,
    businessName,
    website: normalizeWebsite(payload.website),
    address: trimOrNull(payload.address),
    companyPhone: formatPhoneForStorage(payload.phone) ?? contactPhone,
    companyEmail: trimOrNull(payload.email)?.toLowerCase() ?? contactEmail,
    contactFirstName: first_name,
    contactLastName: last_name,
    contactEmail,
    contactPhone,
    leadSource: isReferral ? "Referido" : "WebSite Visit",
    interestedService,
    background,
    sector: mapPrimaryCategoryToSector(payload.primaryCategory),
    referredByContactId: null,
    shouldCreateDeal,
    dealName,
    dealDescription: background || `Lead ingested from ${source}`,
  };
};
