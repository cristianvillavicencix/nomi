/**
 * LBS Agency Project model — canonical definitions for marketing/web projects.
 * Storage remains `deals`; this module defines semantics only.
 */

export const LBS_LIFECYCLE_PHASES = [
  "opportunity",
  "delivery",
  "closed",
] as const;
export type LbsLifecyclePhase = (typeof LBS_LIFECYCLE_PHASES)[number];

export const LBS_DEFAULT_LIFECYCLE_PHASE: LbsLifecyclePhase = "delivery";

export const LBS_PROJECT_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

export type LbsProjectPriority =
  (typeof LBS_PROJECT_PRIORITIES)[number]["value"];

export const LBS_DEFAULT_PROJECT_PRIORITY: LbsProjectPriority = "normal";

/** Kanban columns — post-proposal execution pipeline. */
export const lbsAgencyPipelineStages = [
  { value: "setup", label: "Setup" },
  { value: "in_progress", label: "In progress" },
  { value: "client_review", label: "Client review" },
  { value: "launch", label: "Launch" },
  { value: "delivered", label: "Delivered" },
] as const;

export type LbsAgencyPipelineStage =
  (typeof lbsAgencyPipelineStages)[number]["value"];

export const LBS_DEFAULT_AGENCY_STAGE: LbsAgencyPipelineStage = "setup";

/** Detailed operational status within delivery phase. */
export const lbsDeliveryStatuses = [
  { value: "planning", label: "Planning" },
  { value: "waiting_client", label: "Waiting for client info" },
  { value: "in_design", label: "In design" },
  { value: "in_development", label: "In development" },
  { value: "internal_review", label: "Internal review" },
  { value: "client_review", label: "Client review" },
  { value: "revisions", label: "Revisions requested" },
  { value: "ready_to_launch", label: "Ready to launch" },
  { value: "launched", label: "Launched" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On hold" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type LbsDeliveryStatus = (typeof lbsDeliveryStatuses)[number]["value"];

export const LBS_DEFAULT_DELIVERY_STATUS: LbsDeliveryStatus = "planning";

/** Primary agency service types (LBS product). */
export const lbsAgencyProjectTypes = [
  { value: "website", label: "Website" },
  { value: "seo", label: "SEO" },
  { value: "google-ads", label: "Google Ads" },
  { value: "social-media", label: "Social Media" },
  { value: "branding", label: "Branding" },
  { value: "automation", label: "Automation" },
  { value: "crm-setup", label: "CRM Setup" },
  { value: "maintenance", label: "Maintenance / Hosting" },
] as const;

export type LbsAgencyProjectType =
  (typeof lbsAgencyProjectTypes)[number]["value"];

export const LBS_DEFAULT_AGENCY_PROJECT_TYPE: LbsAgencyProjectType = "website";

/** Maps legacy project_type slugs to canonical agency types. */
export const LEGACY_AGENCY_PROJECT_TYPE_MAP: Record<
  string,
  LbsAgencyProjectType
> = {
  "new-website": "website",
  redesign: "website",
  "landing-page": "website",
  ecommerce: "website",
  seo: "seo",
  "google-ads": "google-ads",
  "social-media": "social-media",
  branding: "branding",
  maintenance: "maintenance",
  "email-marketing": "automation",
};

export const normalizeAgencyProjectType = (
  value?: string | null,
): LbsAgencyProjectType => {
  if (!value) return LBS_DEFAULT_AGENCY_PROJECT_TYPE;
  const direct = lbsAgencyProjectTypes.find((t) => t.value === value);
  if (direct) return direct.value;
  return (
    LEGACY_AGENCY_PROJECT_TYPE_MAP[value] ?? LBS_DEFAULT_AGENCY_PROJECT_TYPE
  );
};

export const getAgencyProjectTypeLabel = (value?: string | null) => {
  const normalized = normalizeAgencyProjectType(value);
  return (
    lbsAgencyProjectTypes.find((t) => t.value === normalized)?.label ??
    value?.replace(/-/g, " ") ??
    "Website"
  );
};

/** Maps Kanban stage → default delivery_status. */
export const STAGE_TO_DELIVERY_STATUS: Record<string, LbsDeliveryStatus> = {
  setup: "planning",
  in_progress: "in_development",
  client_review: "client_review",
  launch: "ready_to_launch",
  delivered: "completed",
};

export const deliveryStatusForStage = (
  stage?: string | null,
): LbsDeliveryStatus =>
  STAGE_TO_DELIVERY_STATUS[stage ?? ""] ?? LBS_DEFAULT_DELIVERY_STATUS;

export const getDeliveryStatusLabel = (value?: string | null) =>
  lbsDeliveryStatuses.find((s) => s.value === value)?.label ??
  value?.replace(/_/g, " ") ??
  "";

/** Fields that belong to contractor/construction — do not expose in LBS project UI. */
export const LBS_CONTRACTOR_DEAL_FIELDS = [
  "subcontractor_ids",
  "worker_ids",
  "value_includes_material",
  "original_project_value",
  "current_project_value",
  "project_address",
  "project_place_id",
  "project_address_meta",
] as const;

/** Child resources contractor-only — hide from LBS resource registry (Fase 9). */
export const LBS_CONTRACTOR_DEAL_RESOURCES = [
  "deal_subcontractor_entries",
  "deal_expenses",
  "deal_change_orders",
  "deal_commissions",
  "deal_cost_entries",
  "deal_workers",
  "deal_subcontractors",
] as const;

/**
 * Agency project flow stages (product language):
 * Lead → Client → Proposal → Accept → Project → Brief → Assets → Tasks → Review → Launch → Completed
 */
export const LBS_AGENCY_FLOW = [
  { id: "lead", label: "Lead", mapsTo: "contacts.status" },
  { id: "client", label: "Client", mapsTo: "companies + contacts" },
  { id: "proposal", label: "Proposal", mapsTo: "proposals" },
  { id: "project", label: "Project", mapsTo: "deals.lifecycle_phase=delivery" },
  { id: "brief", label: "Brief", mapsTo: "deals.website_brief" },
  { id: "assets", label: "Assets", mapsTo: "deal_resources" },
  { id: "tasks", label: "Tasks", mapsTo: "tasks.deal_id" },
  { id: "review", label: "Review", mapsTo: "delivery_status=client_review" },
  { id: "launch", label: "Launch", mapsTo: "stage=launch" },
  { id: "completed", label: "Completed", mapsTo: "lifecycle_phase=closed" },
] as const;
