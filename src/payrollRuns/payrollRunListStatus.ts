import type { Payment, PayrollRun } from "@/components/atomic-crm/types";

/** List-friendly labels; “Pending payment” when the run is approved but payout is not closed. */
export const getPayrollRunListStatusDisplay = (
  record: PayrollRun,
  payment?: Payment | null,
): { label: string; badgeClassName: string } => {
  const paymentPaid = payment?.status === "paid";

  if (record.status === "cancelled") {
    return {
      label: "Cancelled",
      badgeClassName:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100",
    };
  }
  if (record.status === "paid" || paymentPaid) {
    return {
      label: "Paid",
      badgeClassName:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
    };
  }
  if (record.status === "approved") {
    return {
      label: "Pending payment",
      badgeClassName:
        "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
    };
  }
  if (record.status === "reviewed") {
    return {
      label: "Pending approval",
      badgeClassName:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    };
  }
  if (record.status === "draft") {
    return {
      label: "Draft",
      badgeClassName:
        "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100",
    };
  }
  return {
    label: record.status,
    badgeClassName:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
  };
};
