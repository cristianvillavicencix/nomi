import type { FormSubmissionV2 } from "@/lbs/forms-v2/types";

export const buildSubmissionStatusPatch = (
  status: string,
  previous: FormSubmissionV2,
  reviewerMemberId?: number | null,
): Partial<FormSubmissionV2> => {
  const patch: Partial<FormSubmissionV2> = { status };

  if (status === "reviewed") {
    patch.reviewed_at = new Date().toISOString();
    if (reviewerMemberId != null) {
      patch.reviewed_by_member_id = reviewerMemberId;
    }
  }

  return patch;
};
