import type { ConfigurationContextValue } from "./ConfigurationContext";
import { defaultPayrollSettings } from "@/payroll/rules";
import { isLbsMode } from "@/lbs/productMode";
import {
  buildLbsDealPipelines,
  lbsProjectStages,
  LBS_WON_PIPELINE_STATUSES,
} from "@/lbs/deals/lbsProjectConstants";

/** Logo paths must be root-absolute; `./logos/...` breaks on nested routes like `/contacts/1/show`. */
export const normalizeLogoUrl = (url?: string | null): string => {
  if (!url?.trim()) return "";
  if (url.startsWith("./")) {
    return `/${url.slice(2)}`;
  }
  return url;
};

export const defaultDarkModeLogo = "/logos/logo_atomic_crm_dark.svg";
export const defaultLightModeLogo = "/logos/logo_atomic_crm_light.svg";

export const defaultTitle = isLbsMode() ? "LBS CRM" : "Nomi CRM";

/** Older deployments may still store this as `title` / `companyLegalName` in `configuration.config`. */
export const LEGACY_DEFAULT_APP_TITLE = "Atomic CRM";

/**
 * Maps the legacy product name in stored config to {@link defaultTitle} so all users
 * (including new signups and invites) see the current branding.
 */
export function withCurrentProductName<
  T extends {
    title?: string;
    companyLegalName?: string;
    darkModeLogo?: string;
    lightModeLogo?: string;
  },
>(config: T): T {
  const out: T = { ...config };
  if (out.title === LEGACY_DEFAULT_APP_TITLE) {
    out.title = defaultTitle;
  }
  if (out.companyLegalName === LEGACY_DEFAULT_APP_TITLE) {
    out.companyLegalName = defaultTitle;
  }
  if (out.darkModeLogo) {
    out.darkModeLogo = normalizeLogoUrl(out.darkModeLogo);
  }
  if (out.lightModeLogo) {
    out.lightModeLogo = normalizeLogoUrl(out.lightModeLogo);
  }
  return out;
}

/**
 * Used in Settings “Your sector” Select: Radix SelectItem cannot use `value=""`, so we store this
 * in the form when no industry is chosen and map to {@link ConfigurationContextValue.primaryBusinessSector} "" on save.
 */
export const primaryBusinessSectorUnsetToken = "__unset__";

export const defaultCompanySectors = [
  { value: "communication-services", label: "Communication Services" },
  { value: "consumer-discretionary", label: "Consumer Discretionary" },
  { value: "consumer-staples", label: "Consumer Staples" },
  { value: "energy", label: "Energy" },
  { value: "financials", label: "Financials" },
  { value: "health-care", label: "Health Care" },
  { value: "industrials", label: "Industrials" },
  { value: "information-technology", label: "Information Technology" },
  { value: "materials", label: "Materials" },
  { value: "real-estate", label: "Real Estate" },
  { value: "utilities", label: "Utilities" },
];

export const contractorDealStages = [
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "material_ordered", label: "Material Ordered" },
  { value: "pending_inspection", label: "Pending Inspection" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

export const lbsDealStages = lbsProjectStages;

export const defaultDealStages = isLbsMode() ? lbsDealStages : contractorDealStages;

export const defaultDealPipelineStatuses = isLbsMode()
  ? LBS_WON_PIPELINE_STATUSES
  : ["completed", "closed"];

export const defaultDealPipelines = isLbsMode()
  ? buildLbsDealPipelines()
  : [
      {
        id: "default",
        label: "Default Board",
        order: 1,
        isDefault: true,
        stages: contractorDealStages.map((stage, index) => ({
          id: stage.value,
          label: stage.label,
          color:
            stage.value === "completed"
              ? "#16a34a"
              : stage.value === "closed"
                ? "#0f766e"
                : "#64748b",
          order: index + 1,
          pipelineId: "default",
          isDefault: stage.value === "approved",
        })),
      },
    ];

export const defaultDealCategories = isLbsMode()
  ? [
      { value: "website", label: "Website" },
      { value: "seo", label: "SEO" },
      { value: "google-ads", label: "Google Ads" },
      { value: "maintenance", label: "Maintenance" },
    ]
  : [
      { value: "retail", label: "Retail" },
      { value: "insurance", label: "Insurance" },
    ];

export const contractorNoteStatuses = [
  { value: "cold", label: "Cold", color: "#7dbde8" },
  { value: "warm", label: "Warm", color: "#e8cb7d" },
  { value: "hot", label: "Hot", color: "#e88b7d" },
  { value: "in-contract", label: "In Contract", color: "#a4e87d" },
];

export const lbsNoteStatuses = [
  { value: "new", label: "New", color: "#7dbde8" },
  { value: "contacted", label: "Contacted", color: "#94a3b8" },
  { value: "qualified", label: "Qualified", color: "#e8cb7d" },
  { value: "proposal-sent", label: "Proposal Sent", color: "#c084fc" },
  { value: "won", label: "Won", color: "#16a34a" },
  { value: "lost", label: "Lost", color: "#ef4444" },
  { value: "client", label: "Client", color: "#a4e87d" },
  ...contractorNoteStatuses,
];

export const defaultNoteStatuses = isLbsMode()
  ? lbsNoteStatuses
  : contractorNoteStatuses;

export const defaultTaskTypes = [
  { value: "none", label: "None" },
  { value: "email", label: "Email" },
  { value: "demo", label: "Demo" },
  { value: "lunch", label: "Lunch" },
  { value: "meeting", label: "Meeting" },
  { value: "follow-up", label: "Follow-up" },
  { value: "thank-you", label: "Thank you" },
  { value: "ship", label: "Ship" },
  { value: "call", label: "Call" },
];

export const lbsTaskTypes = [
  { value: "none", label: "General" },
  { value: "brief-review", label: "Brief review" },
  { value: "design-approval", label: "Design approval" },
  { value: "content-request", label: "Content request" },
  { value: "client-follow-up", label: "Client follow-up" },
  { value: "launch", label: "Launch" },
  { value: "internal", label: "Internal" },
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
];

export const configuredTaskTypes = isLbsMode() ? lbsTaskTypes : defaultTaskTypes;

export const defaultConfiguration: ConfigurationContextValue = {
  companySectors: defaultCompanySectors,
  primaryBusinessSector: "",
  companyLegalName: defaultTitle,
  companyTaxId: "",
  companyAddressLine1: "",
  companyAddressLine2: "",
  companyCity: "",
  companyState: "",
  companyPostalCode: "",
  companyCountry: "United States",
  companyPhone: "",
  companyEmail: "",
  companyWebsite: "",
  companyRepresentativeName: "",
  companyRepresentativeTitle: "Authorized Representative",
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  dealPipelines: defaultDealPipelines,
  projectsView: "board",
  noteStatuses: defaultNoteStatuses,
  taskTypes: configuredTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
  payrollSettings: defaultPayrollSettings,
};
