import {
  LBS_CONTACT_STATUSES_FOR_FILTER,
  LBS_LEAD_STATUSES_FOR_FILTER,
} from "@/app/navigation";

export const statusInFilter = (statuses: readonly string[]) =>
  `(${statuses.map((status) => `"${status}"`).join(",")})`;

export const LEAD_STATUS_FILTER = statusInFilter(LBS_LEAD_STATUSES_FOR_FILTER);
export const CONTACT_STATUS_FILTER = statusInFilter(
  LBS_CONTACT_STATUSES_FOR_FILTER,
);

export const relatedPreviewItemClassName =
  "block w-full rounded-lg border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40";
