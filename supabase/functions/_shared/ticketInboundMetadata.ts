export type InboundEmailHeader = {
  Name?: string;
  Value?: string;
};

export type CompanyCamInboundMetadata = {
  isCompanyCam: boolean;
  tags: string[];
  normalizedSubject: string;
  propertyAddress: string | null;
};

const COMPANY_CAM_SUBJECT_MARKER = /_companycam/i;
const COMPANY_CAM_HEADER_PREFIX = "x-cm-";

/** US-style street address at start of subject (CompanyCam exports). */
const SUBJECT_ADDRESS_PATTERN =
  /^(\d[\d\sA-Za-z.-]*\s+(?:[NSEW]\s+)?(?:[A-Za-z0-9.'-]+\s+){0,6}(?:DR|ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|BOULEVARD|LN|LANE|WAY|CT|COURT|PL|PLACE|CIR|CIRCLE|HWY|PIKE|TRL|TRAIL)\.?[^,_]*)/i;

export const extractPropertyAddressFromSubject = (subject: string) => {
  const trimmed = subject.trim();
  if (!trimmed) return null;

  const beforeCompanyCam = trimmed.split(COMPANY_CAM_SUBJECT_MARKER)[0]?.trim();
  const candidate = beforeCompanyCam || trimmed;
  const match = candidate.match(SUBJECT_ADDRESS_PATTERN);
  if (!match?.[1]) return null;

  return match[1]
    .replace(/\s+/g, " ")
    .replace(/[_]+/g, " ")
    .trim();
};

export const detectCompanyCamInbound = (params: {
  headers?: InboundEmailHeader[];
  subject: string;
  fromEmail?: string | null;
}): CompanyCamInboundMetadata => {
  const subject = params.subject.trim() || "(No subject)";
  const headers = params.headers ?? [];
  const fromEmail = params.fromEmail?.trim().toLowerCase() ?? "";

  const hasCompanyCamHeader = headers.some((header) =>
    header.Name?.trim().toLowerCase().startsWith(COMPANY_CAM_HEADER_PREFIX)
  );
  const subjectHintsCompanyCam =
    COMPANY_CAM_SUBJECT_MARKER.test(subject) ||
    /\bcompanycam\b/i.test(subject);

  const isCompanyCam =
    hasCompanyCamHeader ||
    subjectHintsCompanyCam ||
    fromEmail.includes("companycam");

  let normalizedSubject = subject;
  if (COMPANY_CAM_SUBJECT_MARKER.test(subject)) {
    normalizedSubject =
      subject.split(COMPANY_CAM_SUBJECT_MARKER)[0]?.trim() || subject;
  }

  const propertyAddress = extractPropertyAddressFromSubject(subject);
  if (propertyAddress && isCompanyCam) {
    normalizedSubject = propertyAddress;
  }

  return {
    isCompanyCam,
    tags: isCompanyCam ? ["companycam"] : [],
    normalizedSubject,
    propertyAddress,
  };
};
