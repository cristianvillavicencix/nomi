export type DeliveryAnalysisStatus = "ok" | "warning" | "error";

export type DeliveryAnalysisItem = {
  id: string;
  label: string;
  status: DeliveryAnalysisStatus;
  detail: string;
  fixHint?: string;
  pendingLabels?: string[];
};

export type ProjectDeliveryAnalysisInput = {
  briefPercent: number;
  productionUrl?: string | null;
  credentialsCount: number;
  pendingChecklistCount: number;
  pendingChecklistLabels?: string[];
  resourcesCount: number;
  hasPortalAccount: boolean;
  hasLinkedContact: boolean;
};

export const DELIVERY_ANALYSIS_FIX_HINTS: Record<string, string> = {
  brief: "Complete the website brief in Overview",
  production_url: "Add the production URL under Security → Deployment",
  credentials: "Add credentials under Security",
  launch_checklist: "Complete items below or use Deliver anyway",
  resources: "Upload files in the project resources section",
  portal: "Link a client contact on the project overview",
};

const formatPendingChecklistDetail = (
  count: number,
  labels: string[],
): string => {
  if (count <= 0) return "Complete";
  if (labels.length === 0) {
    return `${count} item${count === 1 ? "" : "s"} pending`;
  }
  const preview = labels.slice(0, 2).join(", ");
  const extra = labels.length > 2 ? ` +${labels.length - 2} more` : "";
  return `${count} pending: ${preview}${extra}`;
};

export const buildProjectDeliveryAnalysis = (
  input: ProjectDeliveryAnalysisInput,
): DeliveryAnalysisItem[] => {
  const productionUrl = input.productionUrl?.trim() ?? "";
  const pendingLabels = input.pendingChecklistLabels ?? [];

  const briefStatus: DeliveryAnalysisStatus =
    input.briefPercent >= 100
      ? "ok"
      : input.briefPercent >= 70
        ? "warning"
        : "error";

  const urlStatus: DeliveryAnalysisStatus = productionUrl ? "ok" : "error";

  const credentialsStatus: DeliveryAnalysisStatus =
    input.credentialsCount > 0 ? "ok" : "warning";

  const checklistStatus: DeliveryAnalysisStatus =
    input.pendingChecklistCount > 0 ? "warning" : "ok";

  const resourcesStatus: DeliveryAnalysisStatus =
    input.resourcesCount > 0 ? "ok" : "warning";

  let portalDetail = "Will be created automatically";
  let portalStatus: DeliveryAnalysisStatus = "ok";
  if (!input.hasLinkedContact) {
    portalDetail = "Link a client contact first";
    portalStatus = "error";
  } else if (input.hasPortalAccount) {
    portalDetail = "Portal account ready";
  }

  return [
    {
      id: "brief",
      label: "Brief completed",
      status: briefStatus,
      detail: `${input.briefPercent}%`,
      fixHint:
        briefStatus !== "ok" ? DELIVERY_ANALYSIS_FIX_HINTS.brief : undefined,
    },
    {
      id: "production_url",
      label: "Production URL",
      status: urlStatus,
      detail: productionUrl || "Missing",
      fixHint:
        urlStatus === "error"
          ? DELIVERY_ANALYSIS_FIX_HINTS.production_url
          : undefined,
    },
    {
      id: "credentials",
      label: "Security credentials",
      status: credentialsStatus,
      detail:
        input.credentialsCount > 0
          ? `${input.credentialsCount} credential${input.credentialsCount === 1 ? "" : "s"} ready`
          : "No credentials yet",
      fixHint:
        credentialsStatus === "warning"
          ? DELIVERY_ANALYSIS_FIX_HINTS.credentials
          : undefined,
    },
    {
      id: "launch_checklist",
      label: "Launch checklist",
      status: checklistStatus,
      detail: formatPendingChecklistDetail(
        input.pendingChecklistCount,
        pendingLabels,
      ),
      fixHint:
        checklistStatus === "warning"
          ? DELIVERY_ANALYSIS_FIX_HINTS.launch_checklist
          : undefined,
      pendingLabels: pendingLabels.length > 0 ? pendingLabels : undefined,
    },
    {
      id: "resources",
      label: "Multimedia files",
      status: resourcesStatus,
      detail:
        input.resourcesCount > 0
          ? `${input.resourcesCount} file${input.resourcesCount === 1 ? "" : "s"}`
          : "No files uploaded",
      fixHint:
        resourcesStatus === "warning"
          ? DELIVERY_ANALYSIS_FIX_HINTS.resources
          : undefined,
    },
    {
      id: "portal",
      label: "Client portal",
      status: portalStatus,
      detail: portalDetail,
      fixHint:
        portalStatus === "error"
          ? DELIVERY_ANALYSIS_FIX_HINTS.portal
          : undefined,
    },
  ];
};

export const getBlockingDeliveryAnalysisItems = (
  items: DeliveryAnalysisItem[],
) => items.filter((item) => item.status === "error");

export const hasBlockingDeliveryAnalysis = (items: DeliveryAnalysisItem[]) =>
  getBlockingDeliveryAnalysisItems(items).length > 0;

export const hasDeliveryAnalysisWarnings = (items: DeliveryAnalysisItem[]) =>
  items.some((item) => item.status === "warning");

export const formatDeliveryAnalysisBlockerMessage = (
  items: DeliveryAnalysisItem[],
): string => {
  const blockers = getBlockingDeliveryAnalysisItems(items);
  if (blockers.length === 0) {
    return "Resolve the items marked in red before continuing.";
  }

  return blockers
    .map((item) => {
      const hint = item.fixHint ? ` — ${item.fixHint}` : "";
      return `${item.label}: ${item.detail}${hint}`;
    })
    .join(". ");
};
