import { computeAutoMaintenanceReviewDate } from "@/modules/deals/projects/delivery/projectMaintenanceReview";
import type { PortalDelivery } from "@/modules/portal/portalTypes";

const readMaintenancePlanField = (
  delivery: PortalDelivery,
  key: string,
): unknown => {
  const plan = delivery.maintenance_plan;
  if (!plan || typeof plan !== "object") return undefined;
  return (plan as Record<string, unknown>)[key];
};

export const resolveNextMaintenanceDate = (
  delivery: PortalDelivery,
): string | null => {
  const explicit = readMaintenancePlanField(delivery, "next_review_date");
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim();
  }

  const freeMonths = Number(readMaintenancePlanField(delivery, "free_months"));
  if (delivery.delivered_at && Number.isFinite(freeMonths) && freeMonths > 0) {
    return computeAutoMaintenanceReviewDate(
      freeMonths,
      new Date(delivery.delivered_at),
    );
  }

  return null;
};
