import type { ConfigurationContextValue } from "./ConfigurationContext";
import { defaultPayrollSettings } from "@/payroll/rules";

export const defaultDarkModeLogo = "./logos/logo_atomic_crm_dark.svg";
export const defaultLightModeLogo = "./logos/logo_atomic_crm_light.svg";

export const defaultTitle = "Nomi CRM";

/** Older deployments may still store this as `title` / `companyLegalName` in `configuration.config`. */
export const LEGACY_DEFAULT_APP_TITLE = "Atomic CRM";

/**
 * Maps the legacy product name in stored config to {@link defaultTitle} so all users
 * (including new signups and invites) see the current branding.
 */
export function withCurrentProductName<
  T extends { title?: string; companyLegalName?: string },
>(config: T): T {
  const out: T = { ...config };
  if (out.title === LEGACY_DEFAULT_APP_TITLE) {
    out.title = defaultTitle;
  }
  if (out.companyLegalName === LEGACY_DEFAULT_APP_TITLE) {
    out.companyLegalName = defaultTitle;
  }
  return out;
}

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

export const defaultDealStages = [
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "material_ordered", label: "Material Ordered" },
  { value: "pending_inspection", label: "Pending Inspection" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

export const defaultDealPipelineStatuses = ["completed", "closed"];

export const defaultDealPipelines = [
  {
    id: "default",
    label: "Default Board",
    order: 1,
    isDefault: true,
    stages: defaultDealStages.map((stage, index) => ({
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

export const defaultDealCategories = [
  { value: "retail", label: "Retail" },
  { value: "insurance", label: "Insurance" },
];

export const defaultNoteStatuses = [
  { value: "cold", label: "Cold", color: "#7dbde8" },
  { value: "warm", label: "Warm", color: "#e8cb7d" },
  { value: "hot", label: "Hot", color: "#e88b7d" },
  { value: "in-contract", label: "In Contract", color: "#a4e87d" },
];

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

export const defaultConfiguration: ConfigurationContextValue = {
  companySectors: defaultCompanySectors,
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
  companyRepresentativeName: "",
  companyRepresentativeTitle: "Authorized Representative",
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  dealPipelines: defaultDealPipelines,
  projectsView: "board",
  noteStatuses: defaultNoteStatuses,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
  payrollSettings: defaultPayrollSettings,
};
