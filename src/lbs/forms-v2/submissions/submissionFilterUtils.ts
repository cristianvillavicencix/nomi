import type { SubmissionStatus } from "@/lbs/forms-v2/submissions/submissionConstants";

export type SubmissionListFilters = {
  formIds: number[];
  status: SubmissionStatus | "all";
  dateFrom: string;
  dateTo: string;
  hasContact: "all" | "yes" | "no";
  hasDeal: "all" | "yes" | "no";
  sourceSearch: string;
  submitterSearch: string;
};

export const defaultSubmissionFilters = (): SubmissionListFilters => ({
  formIds: [],
  status: "all",
  dateFrom: "",
  dateTo: "",
  hasContact: "all",
  hasDeal: "all",
  sourceSearch: "",
  submitterSearch: "",
});

export const buildSubmissionListFilter = (
  filters: SubmissionListFilters,
): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};

  if (filters.formIds.length === 1) {
    filter["form_instance_id@eq"] = filters.formIds[0];
  } else if (filters.formIds.length > 1) {
    filter["form_instance_id@in"] = `(${filters.formIds.join(",")})`;
  }

  if (filters.status !== "all") {
    filter["status@eq"] = filters.status;
  }

  if (filters.dateFrom) {
    filter["submitted_at@gte"] = `${filters.dateFrom}T00:00:00`;
  }

  if (filters.dateTo) {
    filter["submitted_at@lte"] = `${filters.dateTo}T23:59:59`;
  }

  if (filters.hasContact === "yes") {
    filter["contact_id@not.is"] = "null";
  } else if (filters.hasContact === "no") {
    filter["contact_id@is"] = "null";
  }

  if (filters.hasDeal === "yes") {
    filter["deal_id@not.is"] = "null";
  } else if (filters.hasDeal === "no") {
    filter["deal_id@is"] = "null";
  }

  if (filters.sourceSearch.trim()) {
    filter["utm_source@ilike"] = `%${filters.sourceSearch.trim()}%`;
  }

  return filter;
};

export const matchesSubmitterSearch = (
  submitterSearch: string,
  submission: {
    submitter_name?: string | null;
    submitter_email?: string | null;
    submitter_phone?: string | null;
  },
): boolean => {
  const term = submitterSearch.trim().toLowerCase();
  if (!term) return true;
  const haystack = [
    submission.submitter_name,
    submission.submitter_email,
    submission.submitter_phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
};
