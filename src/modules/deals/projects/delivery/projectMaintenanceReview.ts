export const MAINTENANCE_REVIEW_MILESTONE_TITLE = "Web maintenance review";

export type MaintenanceScheduleMode = "auto" | "manual";

export const computeAutoMaintenanceReviewDate = (
  freeMonths: number,
  fromDate: Date = new Date(),
) => {
  const months = Number.isFinite(freeMonths) && freeMonths > 0 ? freeMonths : 3;
  const next = new Date(fromDate);
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
};

export const formatMaintenanceReviewLabel = (isoDate: string) => {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};
