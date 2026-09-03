export const INVOICE_ORGANIZATION_NAME = "Latino Business Support";

const PRODUCT_APP_TITLES = new Set([
  "SIGMA",
  "Sigma by Latino Business Support",
  "Nomi CRM",
  "LBS CRM",
  "Atomic CRM",
  "LBS",
  "Nomi",
  "NOMI",
  "NOMI CRM",
]);

/** Public-facing org name for client emails/SMS — not the CRM product title. */
export const resolveInvoiceOrganizationName = (config?: {
  title?: string | null;
}) => {
  const title = config?.title?.trim();
  if (title && !PRODUCT_APP_TITLES.has(title)) return title;
  return INVOICE_ORGANIZATION_NAME;
};


export const INVOICE_ORGANIZATION_ADDRESS_LINE =
  "1200 Summer St, Stamford CT, 06902";

export const INVOICE_ORGANIZATION_PHONE = "(203) 303-9148";

export const INVOICE_ORGANIZATION_EMAIL = "info@lbs.bz";

export const INVOICE_ORGANIZATION_WEBSITE = "www.lbs.bz";

export const INVOICE_ORGANIZATION_CONTACT_LINE = `${INVOICE_ORGANIZATION_PHONE} | ${INVOICE_ORGANIZATION_EMAIL}`;

export const INVOICE_ORGANIZATION_ADDRESS_BLOCK = `${INVOICE_ORGANIZATION_ADDRESS_LINE}\n${INVOICE_ORGANIZATION_CONTACT_LINE}`;

export const getPublicInvoiceOrganization = () => ({
  name: INVOICE_ORGANIZATION_NAME,
  website: INVOICE_ORGANIZATION_WEBSITE,
  address: INVOICE_ORGANIZATION_ADDRESS_BLOCK,
});
