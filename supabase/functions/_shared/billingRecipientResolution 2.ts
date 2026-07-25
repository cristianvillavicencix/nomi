type EmailRow = { email?: string | null; isPrimary?: boolean };
type PhoneRow = { number?: string | null; isPrimary?: boolean };

const PREFIX = "lbs:";

const parseLink = (links: string[] | null | undefined, key: string) => {
  const prefix = `${PREFIX}${key}=`;
  const match = links?.find((link) => link.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
};

const parseChannelsJson = <T>(
  links: string[] | null | undefined,
  key: string,
): T[] => {
  const raw = parseLink(links, key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const pickPrimaryEmailRow = (rows?: EmailRow[] | null) => {
  const list = rows ?? [];
  const flagged = list.find(
    (row) => row.isPrimary && row.email?.trim(),
  )?.email?.trim();
  if (flagged) return flagged;
  return list.find((row) => row.email?.trim())?.email?.trim() ?? "";
};

const pickPrimaryPhoneRow = (rows?: PhoneRow[] | null) => {
  const list = rows ?? [];
  const flagged = list.find(
    (row) => row.isPrimary && row.number?.trim(),
  )?.number?.trim();
  if (flagged) return flagged;
  return list.find((row) => row.number?.trim())?.number?.trim() ?? "";
};

export const resolveCompanyBillingEmailFromContext = (params: {
  contextLinks?: string[] | null;
  primaryContactEmails?: EmailRow[] | null;
  businessEmail?: string | null;
}): string => {
  const invoiceEmail = parseLink(params.contextLinks, "invoice_email")?.trim();
  if (invoiceEmail) return invoiceEmail;

  const companyEmails = parseChannelsJson<EmailRow>(
    params.contextLinks,
    "company_emails",
  );
  const companyChannel = pickPrimaryEmailRow(companyEmails);
  if (companyChannel) return companyChannel;

  const primaryContact = pickPrimaryEmailRow(params.primaryContactEmails);
  if (primaryContact) return primaryContact;

  const businessEmail = params.businessEmail?.trim() ||
    parseLink(params.contextLinks, "business_email")?.trim();
  if (businessEmail) return businessEmail;

  return "";
};

export const resolveCompanyBillingPhoneFromContext = (params: {
  contextLinks?: string[] | null;
  primaryContactPhones?: PhoneRow[] | null;
  legacyPhoneNumber?: string | null;
}): string => {
  const invoicePhone = parseLink(params.contextLinks, "invoice_phone")?.trim();
  if (invoicePhone) return invoicePhone;

  const companyPhones = parseChannelsJson<PhoneRow>(
    params.contextLinks,
    "company_phones",
  );
  const companyChannel = pickPrimaryPhoneRow(companyPhones);
  if (companyChannel) return companyChannel;

  const primaryContact = pickPrimaryPhoneRow(params.primaryContactPhones);
  if (primaryContact) return primaryContact;

  if (params.legacyPhoneNumber?.trim()) {
    return params.legacyPhoneNumber.trim();
  }

  return "";
};

export const resolveBillingRecipientEmailFromParts = (params: {
  companyContextLinks?: string[] | null;
  primaryContactEmails?: EmailRow[] | null;
  businessEmail?: string | null;
  contactEmails?: EmailRow[] | null;
  ticketRequesterEmail?: string | null;
  fallbackEmail?: string | null;
}): string => {
  const companyEmail = resolveCompanyBillingEmailFromContext({
    contextLinks: params.companyContextLinks,
    primaryContactEmails: params.primaryContactEmails,
    businessEmail: params.businessEmail,
  });
  if (companyEmail) return companyEmail;

  const contactEmail = pickPrimaryEmailRow(params.contactEmails);
  if (contactEmail) return contactEmail;

  const requester = params.ticketRequesterEmail?.trim();
  if (requester) return requester;

  return params.fallbackEmail?.trim() ?? "";
};
