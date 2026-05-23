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

/**
 * Project pipeline after the client accepts the proposal.
 * Setup → build → review → go live → hand off to client.
 */
export const lbsProjectStages = [
  { value: "setup", label: "Setup" },
  { value: "in_progress", label: "In progress" },
  { value: "client_review", label: "Client review" },
  { value: "launch", label: "Launch" },
  { value: "delivered", label: "Delivered" },
];

/** Contractor / restoration pipeline slugs (not used in LBS). */
export const CONTRACTOR_PROJECT_STAGE_IDS = [
  "approved",
  "scheduled",
  "material_ordered",
  "pending_inspection",
  "completed",
] as const;

/** Maps legacy stage slugs to the post-proposal project pipeline. */
export const LEGACY_LBS_STAGE_MAP: Record<string, string> = {
  lead: "setup",
  discovery: "setup",
  proposal: "setup",
  kickoff: "setup",
  approved: "setup",
  scheduled: "setup",
  closed: "delivered",
  active: "launch",
  on_hold: "in_progress",
  material_ordered: "in_progress",
  pending_inspection: "client_review",
  completed: "delivered",
  content_collection: "in_progress",
  design: "in_progress",
  development: "in_progress",
  review: "client_review",
  live: "launch",
  maintenance: "launch",
};

const LEGACY_PROJECT_PIPELINE_STAGE_IDS = new Set<string>([
  ...CONTRACTOR_PROJECT_STAGE_IDS,
  "lead",
  "discovery",
  "proposal",
  "kickoff",
  "closed",
  "active",
  "on_hold",
]);

export const isLbsProjectStageId = (stageId?: string | null) =>
  !!stageId && !!lbsProjectStageByValue[stageId];

export const isContractorProjectStageId = (stageId?: string | null) =>
  !!stageId &&
  (CONTRACTOR_PROJECT_STAGE_IDS as readonly string[]).includes(stageId);

/** True when the board still uses pre-project or contractor stages. */
export const hasLegacyProjectPipeline = (stageIds: string[]) => {
  if (stageIds.length === 0) return false;
  const isCurrentPipeline =
    stageIds.includes("setup") &&
    stageIds.includes("delivered") &&
    !stageIds.includes("active") &&
    !stageIds.includes("on_hold") &&
    stageIds.length === lbsProjectStages.length;
  if (isCurrentPipeline) return false;
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
export const LBS_DEFAULT_PROJECT_STAGE = "setup";

export const LBS_WON_PIPELINE_STATUSES = ["delivered"];

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
  if (normalized === "launch") return "#16a34a";
  if (normalized === "delivered") return "#0f766e";
  if (normalized === "setup") return "#7dbde8";
  if (normalized === "in_progress") return "#6366f1";
  if (normalized === "client_review") return "#f59e0b";
  return "#64748b";
};
