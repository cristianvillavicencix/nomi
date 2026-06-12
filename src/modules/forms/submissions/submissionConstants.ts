export const SUBMISSION_STATUSES = [
  "new",
  "reviewed",
  "contacted",
  "archived",
  "spam",
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  contacted: "Contacted",
  archived: "Archived",
  spam: "Spam",
};

export const SUBMISSION_STATUS_VARIANT: Record<
  SubmissionStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  new: "default",
  reviewed: "secondary",
  contacted: "outline",
  archived: "outline",
  spam: "destructive",
};

export const isSubmissionStatus = (
  value: string | undefined | null,
): value is SubmissionStatus =>
  SUBMISSION_STATUSES.includes(value as SubmissionStatus);
