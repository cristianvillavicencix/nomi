import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useGetList, useListContext, useRecordContext } from "ra-core";
import type {
  Payment,
  PayrollRun,
  TimeEntry,
} from "@/components/atomic-crm/types";
import { cn } from "@/lib/utils";

export type PayrollFlowTone =
  | "muted"
  | "hours"
  | "approved"
  | "payroll"
  | "payment"
  | "done";

/** Single label: where this row sits in Hours → payroll → payment → paid. */
export type PayrollFlowDisplay = {
  label: string;
  tone: PayrollFlowTone;
};

const toneClass: Record<PayrollFlowTone, string> = {
  muted: "border-slate-200 bg-slate-50 text-slate-700",
  hours: "border-violet-200 bg-violet-50 text-violet-800",
  approved: "border-sky-200 bg-sky-50 text-sky-800",
  payroll: "border-amber-200 bg-amber-50 text-amber-900",
  payment: "border-indigo-200 bg-indigo-50 text-indigo-900",
  done: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

type PipelineContextValue = {
  loading: boolean;
  payrollById: Record<string, PayrollRun>;
  paymentById: Record<string, Payment>;
  paymentByPayrollRunId: Map<string, Payment>;
};

const TimeEntryPipelineContext = createContext<PipelineContextValue | null>(
  null,
);

export function getPayrollFlowDisplay(
  entry: TimeEntry,
  ctx: PipelineContextValue,
): PayrollFlowDisplay {
  const { payrollById, paymentById, paymentByPayrollRunId } = ctx;

  if (entry.status === "rejected") {
    return { label: "Rejected", tone: "muted" };
  }

  if (entry.status === "draft" || entry.status === "submitted") {
    return {
      label:
        entry.status === "draft"
          ? "Draft — not approved yet"
          : "Submitted — pending approval",
      tone: "hours",
    };
  }

  const pr =
    entry.payroll_run_id != null
      ? payrollById[String(entry.payroll_run_id)]
      : undefined;
  const payFromEntry =
    entry.payment_run_id != null
      ? paymentById[String(entry.payment_run_id)]
      : undefined;
  const payFromRun =
    entry.payroll_run_id != null
      ? paymentByPayrollRunId.get(String(entry.payroll_run_id))
      : undefined;
  const payment = payFromEntry ?? payFromRun;

  /** Terminal: money recorded — one “Paid” end state for the row. */
  if (entry.status === "paid" || payment?.status === "paid") {
    return {
      label: "Paid",
      tone: "done",
    };
  }

  /** Furthest stage: payment batch exists and is not fully paid yet. */
  if (payment && payment.status !== "paid") {
    if (payment.status === "approved") {
      return {
        label: "Payment approved — mark paid when funds go out",
        tone: "payment",
      };
    }
    if (payment.status === "draft") {
      return {
        label: "In payment batch (draft)",
        tone: "payment",
      };
    }
    return {
      label: `Payment · ${payment.status}`,
      tone: "payment",
    };
  }

  if (entry.payroll_run_id != null) {
    if (pr?.status === "cancelled") {
      return {
        label: "Payroll run cancelled",
        tone: "muted",
      };
    }
    if (pr) {
      if (pr.status === "draft") {
        return {
          label: `Payroll run · draft (#${pr.id})`,
          tone: "payroll",
        };
      }
      if (pr.status === "reviewed") {
        return {
          label: `Payroll run · reviewed (#${pr.id})`,
          tone: "payroll",
        };
      }
      if (pr.status === "approved") {
        return {
          label: `Payroll run · approved (#${pr.id}) — open payment`,
          tone: "payroll",
        };
      }
      if (pr.status === "paid") {
        return {
          label: `Payroll run · closed (#${pr.id})`,
          tone: "payroll",
        };
      }
      return {
        label: `Payroll run · ${pr.status} (#${pr.id})`,
        tone: "payroll",
      };
    }
    return {
      label: `On payroll run #${entry.payroll_run_id}`,
      tone: "payroll",
    };
  }

  if (entry.status === "approved" && !entry.payroll_run_id) {
    return {
      label: "Approved — ready for payroll run",
      tone: "approved",
    };
  }

  if (entry.status === "included_in_payroll" && !entry.payroll_run_id) {
    return {
      label: "Included — attach to a payroll run",
      tone: "approved",
    };
  }

  return {
    label: entry.status,
    tone: "muted",
  };
}

export function TimeEntryPipelineProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data: entries = [] } = useListContext<TimeEntry>();

  const payrollRunIds = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries) {
      if (e.payroll_run_id != null) s.add(String(e.payroll_run_id));
    }
    return [...s];
  }, [entries]);

  const paymentIds = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries) {
      if (e.payment_run_id != null) s.add(String(e.payment_run_id));
    }
    return [...s];
  }, [entries]);

  const { data: payrollRuns = [], isPending: payrollPending } =
    useGetList<PayrollRun>(
      "payroll_runs",
      {
        pagination: { page: 1, perPage: 500 },
        sort: { field: "id", order: "ASC" },
        filter:
          payrollRunIds.length > 0
            ? { "id@in": `(${payrollRunIds.join(",")})` }
            : { id: -1 },
      },
      { enabled: payrollRunIds.length > 0 },
    );

  const { data: paymentsByIdList = [], isPending: paymentsByIdPending } =
    useGetList<Payment>(
      "payments",
      {
        pagination: { page: 1, perPage: 500 },
        sort: { field: "id", order: "ASC" },
        filter:
          paymentIds.length > 0
            ? { "id@in": `(${paymentIds.join(",")})` }
            : { id: -1 },
      },
      { enabled: paymentIds.length > 0 },
    );

  const { data: paymentsByPayrollList = [], isPending: paymentsByPrPending } =
    useGetList<Payment>(
      "payments",
      {
        pagination: { page: 1, perPage: 500 },
        sort: { field: "id", order: "ASC" },
        filter:
          payrollRunIds.length > 0
            ? { "payroll_run_id@in": `(${payrollRunIds.join(",")})` }
            : { id: -1 },
      },
      { enabled: payrollRunIds.length > 0 },
    );

  const value = useMemo<PipelineContextValue>(() => {
    const payrollById = Object.fromEntries(
      payrollRuns.map((p) => [String(p.id), p]),
    );
    const paymentById = Object.fromEntries(
      paymentsByIdList.map((p) => [String(p.id), p]),
    );
    const paymentByPayrollRunId = new Map<string, Payment>();
    for (const p of paymentsByPayrollList) {
      if (p.payroll_run_id != null) {
        paymentByPayrollRunId.set(String(p.payroll_run_id), p);
      }
    }
    const loading =
      (payrollRunIds.length > 0 && payrollPending) ||
      (paymentIds.length > 0 && paymentsByIdPending) ||
      (payrollRunIds.length > 0 && paymentsByPrPending);

    return {
      loading,
      payrollById,
      paymentById,
      paymentByPayrollRunId,
    };
  }, [
    payrollRuns,
    paymentsByIdList,
    paymentsByPayrollList,
    payrollPending,
    paymentsByIdPending,
    paymentsByPrPending,
    payrollRunIds.length,
    paymentIds.length,
  ]);

  return (
    <TimeEntryPipelineContext.Provider value={value}>
      {children}
    </TimeEntryPipelineContext.Provider>
  );
}

export function PayrollFlowField() {
  const entry = useRecordContext<TimeEntry>();
  const ctx = useContext(TimeEntryPipelineContext);

  if (!entry) return null;

  if (!ctx) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (ctx.loading) {
    return (
      <span className="inline-block h-5 w-24 animate-pulse rounded bg-muted" />
    );
  }

  const flow = getPayrollFlowDisplay(entry, ctx);

  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-[18rem] rounded-md border px-2 py-1 text-[11px] font-medium leading-snug",
        toneClass[flow.tone],
      )}
    >
      {flow.label}
    </span>
  );
}
