const PRODUCT_APP_TITLES = new Set([
  "Nomi CRM",
  "LBS CRM",
  "Atomic CRM",
  "LBS",
  "Nomi",
]);

export const INVOICE_ORGANIZATION_NAME = "Latino Business Support";

export const INVOICE_ORGANIZATION_ADDRESS_LINE =
  "1200 Summer St, Stamford CT, 06902";

export const INVOICE_ORGANIZATION_PHONE = "(203) 303-9148";

export const INVOICE_ORGANIZATION_EMAIL = "info@lbs.bz";

export const INVOICE_ORGANIZATION_WEBSITE = "www.lbs.bz";

export const INVOICE_ORGANIZATION_CONTACT_LINE = `${INVOICE_ORGANIZATION_PHONE} | ${INVOICE_ORGANIZATION_EMAIL}`;

/** Street + phone/email — name and website are shown separately on the document. */
export const INVOICE_ORGANIZATION_ADDRESS_BLOCK = `${INVOICE_ORGANIZATION_ADDRESS_LINE}\n${INVOICE_ORGANIZATION_CONTACT_LINE}`;

export type InvoiceOrganizationBranding = {
  name: string;
  address: string;
  website: string;
  phone: string;
  email: string;
};

export const getInvoiceOrganizationBranding =
  (): InvoiceOrganizationBranding => ({
    name: INVOICE_ORGANIZATION_NAME,
    address: INVOICE_ORGANIZATION_ADDRESS_BLOCK,
    website: INVOICE_ORGANIZATION_WEBSITE,
    phone: INVOICE_ORGANIZATION_PHONE,
    email: INVOICE_ORGANIZATION_EMAIL,
  });

/** Public-facing org name for invoice emails and PDFs — not the app product title. */
export const resolveInvoiceOrganizationName = (config?: {
  title?: string | null;
  companyLegalName?: string | null;
}) => {
  const legal = config?.companyLegalName?.trim();
  if (legal && !PRODUCT_APP_TITLES.has(legal)) return legal;

  const title = config?.title?.trim();
  if (title && !PRODUCT_APP_TITLES.has(title)) return title;

  return INVOICE_ORGANIZATION_NAME;
};

export const buildInvoiceOrganizationEmailTagline = () =>
  `${INVOICE_ORGANIZATION_ADDRESS_LINE} · ${INVOICE_ORGANIZATION_CONTACT_LINE} · ${INVOICE_ORGANIZATION_WEBSITE}`;
