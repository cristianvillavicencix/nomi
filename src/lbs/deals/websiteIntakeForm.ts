export {
  WEBSITE_INTAKE_SLUG,
  WEBSITE_INTAKE_FIELDS,
  emptyWebsiteBriefValues,
  emptyWebsiteIntakeValues,
  getVisibleBriefSections,
  getAllBriefFieldKeys,
} from "@/lbs/deals/websiteBriefSchema";

export type { WebsiteBriefFieldDef, WebsiteBriefSectionDef } from "@/lbs/deals/websiteBriefSchema";

export type WebsiteIntakeField = {
  key: string;
  label: string;
  multiline?: boolean;
  type?: "select";
  choices?: Array<{ value: string; label: string }>;
};

export type ProjectWebFormLinkParams = {
  slug: string;
  companyId?: string | number | null;
  contactId?: string | number | null;
  dealId?: string | number | null;
};

export const buildProjectWebFormUrl = (
  origin: string,
  { slug, companyId, contactId, dealId }: ProjectWebFormLinkParams,
) => {
  const url = new URL(`${origin.replace(/\/$/, "")}/forms/${slug}`);
  if (companyId != null && String(companyId).trim()) {
    url.searchParams.set("company_id", String(companyId));
  }
  if (contactId != null && String(contactId).trim()) {
    url.searchParams.set("contact_id", String(contactId));
  }
  if (dealId != null && String(dealId).trim()) {
    url.searchParams.set("deal_id", String(dealId));
  }
  return url.toString();
};
