export const lbsProjectTypeChoices = [
  { value: "website", label: "Website" },
  { value: "seo", label: "SEO / local SEO" },
  { value: "google-ads", label: "Google Ads campaign" },
  { value: "social-media", label: "Social media management" },
  { value: "branding", label: "Branding / identity" },
  { value: "automation", label: "Automation" },
  { value: "crm-setup", label: "CRM Setup" },
  { value: "maintenance", label: "Maintenance / Hosting" },
  // Legacy values still stored on older records — normalized via normalizeAgencyProjectType
  { value: "new-website", label: "New website (legacy)" },
  { value: "redesign", label: "Website redesign (legacy)" },
  { value: "landing-page", label: "Landing page (legacy)" },
  { value: "ecommerce", label: "E-commerce (legacy)" },
  { value: "email-marketing", label: "Email marketing (legacy)" },
];

/** Full web agency pipeline: sales funnel + delivery + close (9 stages). */
export const LBS_WEB_PIPELINE_STAGES = [
  { value: "lead", label: "Lead" },
  { value: "proposal_sent", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "development", label: "Build" },
  { value: "review", label: "Review" },
  { value: "launch", label: "Launch" },
  { value: "maintenance", label: "Maintenance" },
  { value: "closed_won", label: "Closed" },
  { value: "closed_lost", label: "Lost" },
] as const;

export const lbsProjectStages = LBS_WEB_PIPELINE_STAGES;

/** Pre-delivery sales stages (brief not required). */
export const LBS_PRE_DELIVERY_STAGES = new Set(["lead", "proposal_sent"]);

/** Contractor / restoration pipeline slugs (not used in LBS). */
export const CONTRACTOR_PROJECT_STAGE_IDS = [
  "approved",
  "scheduled",
  "material_ordered",
  "pending_inspection",
  "completed",
] as const;

/** Maps legacy stage slugs to the web agency pipeline. */
export const LEGACY_LBS_STAGE_MAP: Record<string, string> = {
  setup: "won",
  in_progress: "development",
  client_review: "review",
  delivered: "closed_won",
  opportunity: "lead",
  qualified: "lead",
  discovery: "lead",
  pending_payment: "won",
  proposal: "proposal_sent",
  negotiation: "proposal_sent",
  kickoff: "won",
  approved: "won",
  scheduled: "development",
  closed: "closed_won",
  active: "launch",
  on_hold: "development",
  material_ordered: "development",
  pending_inspection: "review",
  completed: "closed_won",
  content_collection: "development",
  design: "development",
  development: "development",
  review: "review",
  live: "launch",
  maintenance: "maintenance",
  lost: "closed_lost",
  lead: "lead",
  proposal_sent: "proposal_sent",
  won: "won",
  launch: "launch",
  closed_won: "closed_won",
  closed_lost: "closed_lost",
};

const LEGACY_PROJECT_PIPELINE_STAGE_IDS = new Set<string>([
  ...CONTRACTOR_PROJECT_STAGE_IDS,
  "setup",
  "in_progress",
  "client_review",
  "delivered",
  "opportunity",
  "qualified",
  "proposal",
  "negotiation",
  "kickoff",
  "closed",
  "active",
  "on_hold",
]);

const LBS_WEB_PIPELINE_STAGE_IDS = new Set<string>(
  lbsProjectStages.map((stage) => stage.value),
);

export const isLbsProjectStageId = (stageId?: string | null) =>
  !!stageId && !!lbsProjectStageByValue[stageId];

export const isContractorProjectStageId = (stageId?: string | null) =>
  !!stageId &&
  (CONTRACTOR_PROJECT_STAGE_IDS as readonly string[]).includes(stageId);

/** True when the board still uses pre-agency or contractor stages. */
export const hasLegacyProjectPipeline = (stageIds: string[]) => {
  if (stageIds.length === 0) return false;

  const isWebAgencyPipeline =
    stageIds.includes("lead") &&
    stageIds.includes("closed_lost") &&
    stageIds.length === lbsProjectStages.length &&
    stageIds.every((id) => LBS_WEB_PIPELINE_STAGE_IDS.has(id));
  if (isWebAgencyPipeline) return false;

  const isOldPostProposalPipeline =
    stageIds.includes("setup") &&
    stageIds.includes("delivered") &&
    stageIds.length === 5;
  if (isOldPostProposalPipeline) return true;

  return (
    stageIds.some((id) => LEGACY_PROJECT_PIPELINE_STAGE_IDS.has(id)) ||
    stageIds.includes("active") ||
    stageIds.includes("on_hold") ||
    stageIds.length !== lbsProjectStages.length
  );
};

/** @deprecated Use hasLegacyProjectPipeline */
export const hasContractorProjectPipeline = hasLegacyProjectPipeline;

export const lbsProjectStageByValue = Object.fromEntries(
  lbsProjectStages.map((stage) => [stage.value, stage.label]),
) as Record<string, string>;

export const normalizeLbsProjectStage = (value?: string | null) => {
  if (!value) return LBS_DEFAULT_PROJECT_STAGE;
  if (lbsProjectStageByValue[value]) return value;
  return LEGACY_LBS_STAGE_MAP[value] ?? value;
};

export const getLbsProjectStageLabel = (value?: string | null) => {
  if (!value) return "";
  const normalized = normalizeLbsProjectStage(value);
  return lbsProjectStageByValue[normalized] ?? value.replace(/_/g, " ");
};

export const LBS_DEFAULT_PROJECT_CATEGORY = "website";
export const LBS_DEFAULT_PROJECT_TYPE = "website";
export const LBS_DEFAULT_PROJECT_STAGE = "lead";

export const LBS_WON_PIPELINE_STATUSES = ["closed_won", "won", "delivered"];

export type LbsProjectScopeMode = "pages" | "single" | "deliverables";

const LBS_PAGE_PROJECT_TYPES = new Set([
  "website",
  "new-website",
  "redesign",
  "ecommerce",
  "crm-setup",
]);
const LBS_DELIVERABLES_PROJECT_TYPES = new Set([
  "seo",
  "google-ads",
  "social-media",
  "email-marketing",
  "branding",
  "maintenance",
  "automation",
]);

export const getLbsProjectScopeMode = (
  projectType?: string | null,
): LbsProjectScopeMode => {
  if (!projectType || LBS_PAGE_PROJECT_TYPES.has(projectType)) return "pages";
  if (projectType === "landing-page") return "single";
  if (LBS_DELIVERABLES_PROJECT_TYPES.has(projectType)) return "deliverables";
  return "pages";
};

export const LBS_LANDING_PAGE_SCOPE = "Landing page";

/** Website / web build types that use GitHub on create/edit. */
const PROJECT_TYPES_WITH_GITHUB = new Set([
  "website",
  "new-website",
  "redesign",
  "landing-page",
  "ecommerce",
]);

/** Types that ask for the current/live site URL on create/edit. */
const PROJECT_TYPES_WITH_WEBSITE_URL = new Set([
  "website",
  "new-website",
  "redesign",
  "landing-page",
  "ecommerce",
  "maintenance",
  "seo",
  "google-ads",
]);

/** Types that ask for domain + hosting on create/edit. */
const PROJECT_TYPES_WITH_DOMAIN_HOSTING = new Set([
  "website",
  "new-website",
  "redesign",
  "landing-page",
  "ecommerce",
  "maintenance",
]);

export const projectTypeShowsGithub = (projectType?: string | null) =>
  Boolean(projectType && PROJECT_TYPES_WITH_GITHUB.has(projectType));

export const projectTypeShowsWebsiteUrl = (projectType?: string | null) =>
  Boolean(projectType && PROJECT_TYPES_WITH_WEBSITE_URL.has(projectType));

export const projectTypeShowsDomainHosting = (projectType?: string | null) =>
  Boolean(projectType && PROJECT_TYPES_WITH_DOMAIN_HOSTING.has(projectType));

export const projectTypeShowsServiceDetails = (projectType?: string | null) =>
  projectTypeShowsWebsiteUrl(projectType) ||
  projectTypeShowsDomainHosting(projectType) ||
  projectTypeShowsGithub(projectType);

export const buildLbsDealPipelineStages = () =>
  lbsProjectStages.map((stage, index) => ({
    id: stage.value,
    label: stage.label,
    color: getLbsStageColor(stage.value),
    order: index + 1,
    pipelineId: "default",
    isDefault: stage.value === LBS_DEFAULT_PROJECT_STAGE,
  }));

export const buildLbsDealPipelines = () => [
  {
    id: "default",
    label: "Default Board",
    order: 1,
    isDefault: true,
    stages: buildLbsDealPipelineStages(),
  },
];

export const getLbsStageColor = (stageValue: string) => {
  const normalized = normalizeLbsProjectStage(stageValue);
  if (normalized === "lead") return "#64748b";
  if (normalized === "proposal_sent") return "#f59e0b";
  if (normalized === "won") return "#16a34a";
  if (normalized === "development") return "#6366f1";
  if (normalized === "review") return "#f97316";
  if (normalized === "launch") return "#0d9488";
  if (normalized === "maintenance") return "#06b6d4";
  if (normalized === "closed_won") return "#0f766e";
  if (normalized === "closed_lost") return "#dc2626";
  if (normalized === "delivered") return "#0f766e";
  if (normalized === "setup") return "#7dbde8";
  if (normalized === "in_progress") return "#6366f1";
  if (normalized === "client_review") return "#f59e0b";
  return "#64748b";
};
