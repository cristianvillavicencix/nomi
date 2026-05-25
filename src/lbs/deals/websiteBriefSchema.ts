import {
  CONTRACTOR_BRIEF_SECTIONS,
  getVisibleContractorBriefSections,
  usesContractorBriefForm,
} from "@/lbs/deals/contractorBriefSchema";
import {
  getLbsProjectScopeMode,
  lbsProjectTypeChoices,
  type LbsProjectScopeMode,
} from "@/lbs/deals/lbsProjectConstants";

export const WEBSITE_INTAKE_SLUG = "website-intake";

const WEBSITE_TYPES = new Set(["new-website", "redesign", "ecommerce"]);
const LANDING_TYPES = new Set(["landing-page"]);
const ECOMMERCE_TYPES = new Set(["ecommerce"]);
const REDESIGN_TYPES = new Set(["redesign"]);
const CAMPAIGN_TYPES = new Set([
  "seo",
  "google-ads",
  "social-media",
  "email-marketing",
  "branding",
  "maintenance",
]);
const BRAND_CONTENT_TYPES = new Set([
  "new-website",
  "redesign",
  "landing-page",
  "ecommerce",
  "branding",
]);
const TECHNICAL_TYPES = new Set([
  "new-website",
  "redesign",
  "landing-page",
  "ecommerce",
  "maintenance",
]);

export type WebsiteBriefFieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  helperText?: string | false;
  multiline?: boolean;
  rows?: number;
  fullWidth?: boolean;
  fieldType?: string;
  required?: boolean;
  options?: string[];
  accept?: string;
  maxFiles?: number;
  visibleWhen?: import("@/lib/forms-v2/conditionalLogic").VisibleWhen;
  isVisible?: (projectType: string, scopeMode: LbsProjectScopeMode) => boolean;
};

export type WebsiteBriefSectionDef = {
  id: string;
  title: string;
  description?: string;
  fields: WebsiteBriefFieldDef[];
  isVisible?: (projectType: string, scopeMode: LbsProjectScopeMode) => boolean;
};

const field = (
  def: Omit<WebsiteBriefFieldDef, "key"> & { key: string },
): WebsiteBriefFieldDef => def;

export const WEBSITE_BRIEF_SECTIONS: WebsiteBriefSectionDef[] = [
  {
    id: "context",
    title: "Project context",
    description: "What we are building and who it is for.",
    fields: [
      field({
        key: "goals",
        label: "Project goals",
        placeholder: "What should this project achieve?",
        multiline: true,
        rows: 3,
        fullWidth: true,
      }),
      field({
        key: "target_audience",
        label: "Target audience",
        placeholder: "Who is the ideal customer or visitor?",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
      field({
        key: "existing_website",
        label: "Current website",
        placeholder: "https://example.com",
        isVisible: (projectType) =>
          !CAMPAIGN_TYPES.has(projectType) || projectType === "maintenance",
      }),
    ],
  },
  {
    id: "scope",
    title: "Scope & structure",
    description: "Pages, features, and site architecture.",
    isVisible: (_projectType, scopeMode) => scopeMode === "pages",
    fields: [
      field({
        key: "sitemap",
        label: "Sitemap / page list",
        placeholder: "Home, About, Services, Contact, Blog...",
        multiline: true,
        rows: 3,
        fullWidth: true,
      }),
      field({
        key: "menu_structure",
        label: "Main navigation",
        placeholder: "Top menu and footer links",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
      field({
        key: "features_integrations",
        label: "Features & integrations",
        placeholder: "Forms, booking, chat, CRM, maps, multilingual...",
        multiline: true,
        rows: 3,
        fullWidth: true,
      }),
      field({
        key: "contact_forms",
        label: "Forms & lead routing",
        placeholder: "Fields needed and where submissions should go",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
    ],
  },
  {
    id: "landing",
    title: "Landing page",
    description: "Offer, conversion goal, and tracking.",
    isVisible: (projectType) => LANDING_TYPES.has(projectType),
    fields: [
      field({
        key: "offer_headline",
        label: "Offer / headline",
        placeholder: "Main promise on the page",
        fullWidth: true,
      }),
      field({
        key: "primary_cta",
        label: "Primary call to action",
        placeholder: "e.g. Book a free consultation",
      }),
      field({
        key: "conversion_goal",
        label: "Conversion goal",
        placeholder: "Form submit, call, purchase, signup...",
      }),
      field({
        key: "tracking_pixels",
        label: "Tracking & pixels",
        placeholder: "GA4, Meta Pixel, Google Ads conversion ID...",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
    ],
  },
  {
    id: "campaign",
    title: "Campaign & deliverables",
    description: "Keywords, markets, KPIs, and scope for marketing work.",
    isVisible: (_projectType, scopeMode) => scopeMode === "deliverables",
    fields: [
      field({
        key: "scope",
        label: "Scope / deliverables",
        placeholder: "Keywords, ad sets, posts per month, brand assets...",
        multiline: true,
        rows: 3,
        fullWidth: true,
      }),
      field({
        key: "keywords",
        label: "Keywords / topics",
        placeholder: "Priority keywords or content themes",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
      field({
        key: "competitors",
        label: "Competitors",
        placeholder: "Main competitors or reference accounts",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
      field({
        key: "target_markets",
        label: "Target markets / locations",
        placeholder: "Cities, regions, or audience segments",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
      field({
        key: "kpis",
        label: "KPIs / success metrics",
        placeholder: "Rankings, CPL, ROAS, leads per month...",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
      field({
        key: "ad_budget",
        label: "Ad budget / cadence",
        placeholder: "Monthly ad spend, posting frequency...",
      }),
      field({
        key: "tracking_pixels",
        label: "Tracking & ad accounts",
        placeholder: "GA4, Ads, Meta Business Manager IDs...",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
    ],
  },
  {
    id: "ecommerce",
    title: "E-commerce",
    description: "Products, payments, and fulfillment.",
    isVisible: (projectType) => ECOMMERCE_TYPES.has(projectType),
    fields: [
      field({
        key: "products_overview",
        label: "Products / catalog",
        placeholder: "Number of products, categories, variants...",
        multiline: true,
        rows: 3,
        fullWidth: true,
      }),
      field({
        key: "payment_methods",
        label: "Payment methods",
        placeholder: "Stripe, PayPal, Square, in-person...",
      }),
      field({
        key: "shipping_setup",
        label: "Shipping & fulfillment",
        placeholder: "Zones, carriers, flat rate, pickup...",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
      field({
        key: "tax_setup",
        label: "Tax setup",
        placeholder: "States/regions, tax-inclusive pricing...",
      }),
    ],
  },
  {
    id: "redesign",
    title: "Redesign & migration",
    description: "SEO preservation and analytics continuity.",
    isVisible: (projectType) => REDESIGN_TYPES.has(projectType),
    fields: [
      field({
        key: "redirects_map",
        label: "URL redirects (old → new)",
        placeholder: "/old-page → /new-page",
        multiline: true,
        rows: 3,
        fullWidth: true,
      }),
      field({
        key: "preserve_urls",
        label: "URLs that must not change",
        placeholder: "High-traffic or ranked pages to keep",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
      field({
        key: "analytics_ids",
        label: "Analytics & Search Console",
        placeholder: "GA4 property ID, GSC property, Tag Manager...",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
    ],
  },
  {
    id: "brand",
    title: "Content & brand",
    description: "Visual identity and copy. Upload files in the Resources tab.",
    isVisible: (projectType) => BRAND_CONTENT_TYPES.has(projectType),
    fields: [
      field({
        key: "logo",
        label: "Logo",
        placeholder: "Link or note — upload files in Resources",
        helperText: "Upload logo files in the Resources tab.",
      }),
      field({
        key: "brand_colors",
        label: "Brand colors",
        placeholder: "Hex codes or color names",
      }),
      field({
        key: "tone_of_voice",
        label: "Tone of voice",
        placeholder: "Professional, friendly, technical...",
      }),
      field({
        key: "design_references",
        label: "Design references",
        placeholder: "2–3 websites or styles you like",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
      field({
        key: "copy",
        label: "Copy / content",
        placeholder: "Existing text or who will write it",
        multiline: true,
        rows: 3,
        fullWidth: true,
      }),
      field({
        key: "services",
        label: "Services to highlight",
        placeholder: "Main services or product lines",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
      field({
        key: "images",
        label: "Images / photos",
        placeholder: "What photos are needed — upload in Resources",
        helperText: "Upload photos in the Resources tab by category.",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
    ],
  },
  {
    id: "technical",
    title: "Technical setup",
    description: "Domain and hosting. Store logins in the Security tab.",
    isVisible: (projectType) => TECHNICAL_TYPES.has(projectType),
    fields: [
      field({
        key: "domain",
        label: "Domain",
        placeholder: "example.com",
      }),
      field({
        key: "hosting",
        label: "Hosting",
        placeholder: "Current or preferred host",
      }),
      field({
        key: "cms_stack",
        label: "CMS / platform",
        placeholder: "WordPress, Shopify, custom, Webflow...",
      }),
      field({
        key: "staging_url",
        label: "Staging / preview URL",
        placeholder: "https://staging.example.com",
      }),
    ],
  },
  {
    id: "seo",
    title: "SEO & local presence",
    isVisible: (projectType) =>
      WEBSITE_TYPES.has(projectType) ||
      LANDING_TYPES.has(projectType) ||
      projectType === "seo" ||
      projectType === "maintenance",
    fields: [
      field({
        key: "social_links",
        label: "Social profile links",
        placeholder: "Facebook, Instagram, LinkedIn...",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
      field({
        key: "google_business_profile",
        label: "Google Business Profile",
        placeholder: "Link to GBP listing",
      }),
      field({
        key: "analytics_ids",
        label: "Analytics IDs",
        placeholder: "GA4, Search Console — if not covered above",
        isVisible: (projectType) => !REDESIGN_TYPES.has(projectType),
      }),
    ],
  },
  {
    id: "process",
    title: "Process & notes",
    fields: [
      field({
        key: "approval_contact",
        label: "Who approves design & content?",
        placeholder: "Name and role",
      }),
      field({
        key: "out_of_scope",
        label: "Out of scope",
        placeholder: "What is NOT included in this project",
        multiline: true,
        rows: 2,
        fullWidth: true,
      }),
      field({
        key: "client_notes",
        label: "Additional notes",
        placeholder: "Anything else the team should know",
        multiline: true,
        rows: 3,
        fullWidth: true,
      }),
    ],
  },
];

export const isBriefFieldVisible = (
  fieldDef: WebsiteBriefFieldDef,
  projectType: string,
  scopeMode: LbsProjectScopeMode,
) => fieldDef.isVisible?.(projectType, scopeMode) ?? true;

export const isBriefSectionVisible = (
  section: WebsiteBriefSectionDef,
  projectType: string,
  scopeMode: LbsProjectScopeMode,
) => {
  if (section.isVisible && !section.isVisible(projectType, scopeMode)) {
    return false;
  }
  return section.fields.some((entry) =>
    isBriefFieldVisible(entry, projectType, scopeMode),
  );
};

export const getVisibleBriefSections = (projectType?: string | null) => {
  const normalized = projectType || "new-website";
  if (usesContractorBriefForm(normalized)) {
    return getVisibleContractorBriefSections(normalized).map((section) => ({
      id: section.id,
      title: section.title ?? section.id,
      description: section.description,
      fields: section.fields.map((entry) => ({
        key: entry.key,
        label: entry.label ?? entry.key,
        placeholder: entry.placeholder,
        helperText: entry.help_text,
        multiline: entry.type === "textarea",
        rows: entry.type === "textarea" ? 3 : undefined,
        fullWidth: true,
        fieldType: entry.type,
        required: entry.required,
        options: entry.options,
        accept: entry.accept,
        maxFiles: entry.max_files,
        visibleWhen: entry.visible_when,
      })),
    }));
  }
  const scopeMode = getLbsProjectScopeMode(normalized);
  return WEBSITE_BRIEF_SECTIONS.filter((section) =>
    isBriefSectionVisible(section, normalized, scopeMode),
  ).map((section) => ({
    ...section,
    fields: section.fields.filter((entry) =>
      isBriefFieldVisible(entry, normalized, scopeMode),
    ),
  }));
};

export type BriefSectionStats = {
  filled: number;
  total: number;
  isComplete: boolean;
  isEmpty: boolean;
};

export const getBriefSectionStats = (
  section: WebsiteBriefSectionDef,
  brief: Record<string, string | null | undefined> = {},
): BriefSectionStats => {
  const total = section.fields.length;
  const filled = section.fields.filter((field) => {
    const value = brief[field.key];
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "boolean") return value;
    return Boolean(String(value).trim());
  }).length;
  return {
    filled,
    total,
    isComplete: total > 0 && filled === total,
    isEmpty: filled === 0,
  };
};

const truncatePreview = (value: string, max = 72) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
};

export const getBriefSectionPreview = (
  section: WebsiteBriefSectionDef,
  brief: Record<string, string | null | undefined> = {},
) => {
  const filledValues = section.fields
    .map((field) => String(brief[field.key] ?? "").trim())
    .filter(Boolean);
  if (filledValues.length === 0) return "Not started";
  if (filledValues.length === 1) return truncatePreview(filledValues[0]!);
  return `${truncatePreview(filledValues[0]!)} · +${filledValues.length - 1} more`;
};

export const getBriefOverallStats = (
  projectType: string | undefined | null,
  brief: Record<string, string | null | undefined> = {},
) => {
  const sections = getVisibleBriefSections(projectType);
  return sections.reduce(
    (acc, section) => {
      const stats = getBriefSectionStats(section, brief);
      acc.filled += stats.filled;
      acc.total += stats.total;
      return acc;
    },
    { filled: 0, total: 0 },
  );
};

export const getAllBriefFieldKeys = () => {
  const keys = new Set<string>();
  for (const section of WEBSITE_BRIEF_SECTIONS) {
    for (const entry of section.fields) {
      keys.add(entry.key);
    }
  }
  for (const section of CONTRACTOR_BRIEF_SECTIONS) {
    for (const entry of section.fields) {
      keys.add(entry.key);
    }
  }
  keys.add("scope");
  return Array.from(keys);
};

export const emptyWebsiteBriefValues = (): Record<string, string> => {
  const values: Record<string, string> = { project_type: "website" };
  for (const key of getAllBriefFieldKeys()) {
    values[key] = "";
  }
  return values;
};

/** @deprecated Use getVisibleBriefSections — kept for flat exports */
export const WEBSITE_INTAKE_FIELDS = getAllBriefFieldKeys()
  .filter((key) => key !== "project_type")
  .map((key) => {
    for (const section of WEBSITE_BRIEF_SECTIONS) {
      const match = section.fields.find((entry) => entry.key === key);
      if (match) {
        return {
          key,
          label: match.label,
          multiline: match.multiline,
        };
      }
    }
    return {
      key,
      label: key.replace(/_/g, " "),
    };
  });

export const emptyWebsiteIntakeValues = emptyWebsiteBriefValues;

export type WebsiteBriefApproval = {
  section_id: string;
  status?: "draft" | "client_review" | "approved" | "revision_requested";
  approved_at?: string | null;
  approved_by_member_id?: number | null;
  revision_requested_at?: string | null;
  revision_notes?: string | null;
};

export type WebsiteBriefWithApprovals = Record<
  string,
  string | null | undefined
> & {
  _approvals?: WebsiteBriefApproval[];
};

export const parseBriefApprovals = (brief: unknown): WebsiteBriefApproval[] => {
  if (!brief || typeof brief !== "object") return [];
  const raw = (brief as WebsiteBriefWithApprovals)._approvals;
  return Array.isArray(raw) ? raw : [];
};

export const getBriefSectionApproval = (
  brief: WebsiteBriefWithApprovals,
  sectionId: string,
): WebsiteBriefApproval | undefined =>
  parseBriefApprovals(brief).find((entry) => entry.section_id === sectionId);

export const approveBriefSection = (
  brief: WebsiteBriefWithApprovals,
  sectionId: string,
  memberId?: number | null,
): WebsiteBriefWithApprovals => {
  const approvals = parseBriefApprovals(brief).filter(
    (entry) => entry.section_id !== sectionId,
  );
  return {
    ...brief,
    _approvals: [
      ...approvals,
      {
        section_id: sectionId,
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_member_id: memberId ?? null,
        revision_requested_at: null,
        revision_notes: null,
      },
    ],
  };
};

export const requestBriefSectionRevision = (
  brief: WebsiteBriefWithApprovals,
  sectionId: string,
  notes: string,
): WebsiteBriefWithApprovals => {
  const approvals = parseBriefApprovals(brief).filter(
    (entry) => entry.section_id !== sectionId,
  );
  return {
    ...brief,
    _approvals: [
      ...approvals,
      {
        section_id: sectionId,
        status: "revision_requested",
        revision_requested_at: new Date().toISOString(),
        revision_notes: notes,
        approved_at: null,
      },
    ],
  };
};

/** When a section reaches 100% completion, mark it approved automatically. */
export const syncBriefApprovalsForCompleteSections = (
  brief: WebsiteBriefWithApprovals,
  projectType?: string | null,
  memberId?: number | null,
): WebsiteBriefWithApprovals => {
  let next = brief;
  for (const section of getVisibleBriefSections(projectType)) {
    const stats = getBriefSectionStats(section, next);
    if (!stats.isComplete) continue;
    if (getBriefSectionApproval(next, section.id)?.status === "approved") {
      continue;
    }
    next = approveBriefSection(next, section.id, memberId);
  }
  return next;
};

export { lbsProjectTypeChoices };
