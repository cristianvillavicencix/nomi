import type { UseFormSetValue } from "react-hook-form";
import type { Deal } from "@/components/atomic-crm/types";

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Copy project values from the client's most recent deal into a new-deal form. */
export const applyPriorDealToCreateForm = (
  setValue: UseFormSetValue<Deal & Record<string, unknown>>,
  priorDeal: Deal,
) => {
  if (priorDeal.stage) {
    setValue("stage", priorDeal.stage, { shouldDirty: true });
  }
  if (priorDeal.project_type) {
    setValue("project_type", priorDeal.project_type, { shouldDirty: true });
  }

  const amount =
    toNumber(priorDeal.amount) ?? toNumber(priorDeal.estimated_value);
  if (amount != null && amount > 0) {
    setValue("amount", amount, { shouldDirty: true });
    setValue("estimated_value", amount, { shouldDirty: true });
  }

  if (priorDeal.expected_closing_date) {
    setValue("expected_closing_date", priorDeal.expected_closing_date, {
      shouldDirty: true,
    });
  }

  if (priorDeal.organization_member_id) {
    setValue("organization_member_id", priorDeal.organization_member_id, {
      shouldDirty: true,
    });
  }

  if (priorDeal.priority) {
    setValue("priority", priorDeal.priority, { shouldDirty: false });
  }
};
