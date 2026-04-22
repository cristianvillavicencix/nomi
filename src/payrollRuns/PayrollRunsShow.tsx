import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Banknote, ChevronRight, Loader2, MoreHorizontal } from "lucide-react";
import {
  useCreatePath,
  useDataProvider,
  useGetList,
  useGetOne,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
  useUpdate,
} from "ra-core";
import { Show } from "@/components/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type {
  Payment,
  PayrollRun,
  PayrollRunLine,
  Person,
  TimeEntry,
} from "@/components/atomic-crm/types";
import { cn } from "@/lib/utils";
import { PayrollRunHeaderBadges } from "./payrollRunUi";

const money = (value?: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value ?? 0),
  );

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/** Date + time for timestamps; omits seconds. */
const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return formatDate(value);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

/** Whole hours when applicable; otherwise up to 2 decimals, no trailing zeros. */
const formatPayableHours = (value?: number | null) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded.toFixed(2)).replace(/\.?0+$/, "");
};

const formatTimeValue = (value?: string | null) => {
  if (!value) return "—";
  const s = String(value).trim();
  if (s.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  }
  const match = s.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "—";
  const d = new Date();
  d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getTimeEntryTotalPay = (entry: TimeEntry, employee?: Person) => {
  if (!employee) return 0;
  const rate = Number(employee.hourly_rate ?? 0);
  const overtimeMultiplier = Number(employee.overtime_rate_multiplier ?? 1.5);
  const regular = Number(entry.regular_hours ?? entry.hours ?? 0);
  const overtime = Number(entry.overtime_hours ?? 0);
  return regular * rate + overtime * rate * overtimeMultiplier;
};

const getTimeEntryStatusClassName = (status?: TimeEntry["status"]) => {
  if (status === "paid")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "included_in_payroll")
    return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "approved")
    return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
};

const roundMoney = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const IncludedHoursTable = ({
  lines,
  payrollRun,
  isPayrollClosed,
  variant = "page",
}: {
  lines: PayrollRunLine[];
  payrollRun: PayrollRun;
  isPayrollClosed: boolean;
  variant?: "page" | "dialog";
}) => {
  const payrollRunId = payrollRun.id;
  const [update, { isPending: isSavingDeduction }] = useUpdate<PayrollRun>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [draftDeduction, setDraftDeduction] = useState<string | null>(null);

  useEffect(() => {
    setDraftDeduction(null);
  }, [payrollRun.id, payrollRun.manual_deduction_total]);

  const { data: entries = [], isPending } = useGetList<TimeEntry>(
    "time_entries",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "date", order: "ASC" },
      filter: { payroll_run_id: payrollRunId },
    },
    { enabled: Boolean(payrollRunId) },
  );

  const employeeIds = useMemo(
    () =>
      Array.from(
        new Set(
          entries.map((entry) => entry.person_id).filter((id) => id != null),
        ),
      ),
    [entries],
  );

  const { data: employees = [] } = useGetList<Person>(
    "people",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
      filter: employeeIds.length
        ? { "id@in": `(${employeeIds.join(",")})` }
        : { id: -1 },
    },
    { enabled: employeeIds.length > 0 },
  );

  const employeesById = useMemo(
    () =>
      Object.fromEntries(
        employees.map((employee) => [String(employee.id), employee]),
      ),
    [employees],
  );

  const totals = useMemo(() => {
    const payableHours = entries.reduce(
      (sum, entry) => sum + Number(entry.payable_hours ?? entry.hours ?? 0),
      0,
    );
    const gross = lines.reduce(
      (sum, line) => sum + Number(line.gross_pay ?? 0),
      0,
    );
    const calculatedDeductions = lines.reduce(
      (sum, line) => sum + Number(line.total_deductions ?? 0),
      0,
    );
    return {
      calculatedDeductions,
      gross,
      payableHours,
    };
  }, [entries, lines]);

  const manual = payrollRun.manual_deduction_total;
  const effectiveDeductions = useMemo(() => {
    if (manual != null && Number.isFinite(Number(manual))) {
      return roundMoney(Math.max(0, Number(manual)));
    }
    return roundMoney(totals.calculatedDeductions);
  }, [manual, totals.calculatedDeductions]);

  const effectiveNet = useMemo(
    () => roundMoney(Math.max(0, totals.gross - effectiveDeductions)),
    [totals.gross, effectiveDeductions],
  );

  const showDeductionsBlock =
    totals.calculatedDeductions > 0 || manual != null || !isPayrollClosed;

  const deductionInputValue =
    draftDeduction !== null
      ? draftDeduction
      : manual != null
        ? String(manual)
        : totals.calculatedDeductions > 0
          ? String(totals.calculatedDeductions)
          : "";

  const persistManualDeduction = (next: number | null) => {
    const prevRaw = payrollRun.manual_deduction_total;
    const prevNum = Number(prevRaw);
    const prevNormalized =
      prevRaw == null || Number.isNaN(prevNum) ? null : roundMoney(prevNum);

    const nextRounded =
      next != null && Number.isFinite(next)
        ? roundMoney(Math.max(0, next))
        : null;

    const matchesLines =
      nextRounded != null &&
      nextRounded === roundMoney(totals.calculatedDeductions);

    const payload = nextRounded == null || matchesLines ? null : nextRounded;

    if (payload === prevNormalized) {
      setDraftDeduction(null);
      return;
    }

    update(
      "payroll_runs",
      {
        id: payrollRun.id,
        data: { manual_deduction_total: payload },
        previousData: payrollRun,
      },
      {
        onSuccess: () => {
          setDraftDeduction(null);
          refresh();
        },
        onError: (error) => {
          notify(
            error instanceof Error ? error.message : "Could not save deduction",
            { type: "warning" },
          );
        },
      },
    );
  };

  const handleDeductionBlur = () => {
    const raw = (draftDeduction ?? deductionInputValue).trim();
    if (raw === "") {
      persistManualDeduction(null);
      return;
    }
    const parsed = Number.parseFloat(raw.replace(/,/g, ""));
    if (Number.isNaN(parsed)) {
      notify("Enter a valid amount for deductions.", { type: "warning" });
      setDraftDeduction(null);
      return;
    }
    persistManualDeduction(parsed);
  };

  if (isPending) return null;
  if (!entries.length) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        No hour entries were linked to this payroll run.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "overflow-x-auto rounded-xl border",
          variant === "dialog"
            ? "border-slate-200/90 bg-slate-50/40 shadow-sm"
            : "border-slate-200",
        )}
      >
        <table className="w-full text-sm">
          <thead
            className={cn(
              variant === "dialog" ? "bg-slate-100/90" : "bg-slate-50",
            )}
          >
            <tr className="border-b text-left">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Address</th>
              <th className="px-3 py-2">In</th>
              <th className="px-3 py-2">Lunch</th>
              <th className="px-3 py-2">Out</th>
              <th className="px-3 py-2">Payable hours</th>
              <th className="px-3 py-2">Total pay</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const employee = employeesById[String(entry.person_id)];
              const employeeName = employee
                ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
                : `#${entry.person_id}`;

              return (
                <tr key={entry.id} className="border-b">
                  <td className="px-3 py-2">{formatDate(entry.date)}</td>
                  <td className="px-3 py-2">{employeeName}</td>
                  <td className="px-3 py-2">{entry.work_location ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatTimeValue(entry.start_time)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {(() => {
                      const m = Number(
                        entry.lunch_minutes ?? entry.break_minutes ?? 0,
                      );
                      return m > 0 ? `${m} min` : "—";
                    })()}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatTimeValue(entry.end_time)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatPayableHours(
                      Number(entry.payable_hours ?? entry.hours ?? 0),
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {money(getTimeEntryTotalPay(entry, employee))}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={getTimeEntryStatusClassName(entry.status)}
                    >
                      {entry.status === "approved" ? "Approved" : entry.status}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-white">
            <tr className="border-t-2">
              <td colSpan={6} />
              <td className="px-3 py-4 align-top text-right">
                <div className="flex flex-col items-end gap-4">
                  {showDeductionsBlock ? (
                    <div className="w-full min-w-[10rem]">
                      <div className="text-xs font-semibold uppercase tracking-wide text-red-600 whitespace-nowrap">
                        Deductions:
                      </div>
                      {isPayrollClosed ? (
                        <div className="text-3xl font-semibold tabular-nums text-red-600">
                          {money(effectiveDeductions)}
                        </div>
                      ) : (
                        <Input
                          type="text"
                          inputMode="decimal"
                          disabled={isSavingDeduction}
                          aria-label="Total deductions for this payroll run"
                          placeholder="0.00"
                          className="mt-1 h-auto min-h-10 border-red-200 text-right text-3xl font-semibold tabular-nums text-red-600 shadow-none focus-visible:border-red-400 focus-visible:ring-red-400/30"
                          value={deductionInputValue}
                          onChange={(e) => setDraftDeduction(e.target.value)}
                          onBlur={handleDeductionBlur}
                        />
                      )}
                    </div>
                  ) : null}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                      Total payable hours:
                    </div>
                    <div className="text-3xl font-semibold tabular-nums text-slate-950">
                      {formatPayableHours(totals.payableHours)}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-4 align-top text-right">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                  Gross payroll total:
                </div>
                <div className="text-3xl font-semibold text-slate-950">
                  {money(totals.gross)}
                </div>
              </td>
              <td className="px-3 py-4 align-top text-right">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                  Net payroll total:
                </div>
                <div className="text-3xl font-semibold text-slate-950">
                  {money(effectiveNet)}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

const PayrollRunActions = ({
  lineCount,
  linkedPayment,
}: {
  lineCount: number;
  linkedPayment?: Payment | null;
}) => {
  const record = useRecordContext<PayrollRun>();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const createPath = useCreatePath();
  const redirect = useRedirect();
  const [update, { isPending: isUpdating }] = useUpdate<PayrollRun>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [isGenerating, setIsGenerating] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (!record) return null;

  const paymentIsPaid = linkedPayment?.status === "paid";
  const isPayrollClosed =
    record.status === "paid" || record.status === "cancelled" || paymentIsPaid;

  const canGenerate =
    record.status !== "paid" && record.status !== "cancelled" && !paymentIsPaid;
  const canReview = canGenerate && lineCount > 0 && record.status === "draft";
  const canApprove =
    canGenerate &&
    lineCount > 0 &&
    (record.status === "draft" || record.status === "reviewed");
  const canCancel =
    record.status !== "paid" && record.status !== "cancelled" && !paymentIsPaid;
  const canCreatePayment =
    record.status === "approved" && lineCount > 0 && !paymentIsPaid;
  /** One main action: approve (if needed) + create/open payment — not when payment already closed */
  const canApproveAndRegister = lineCount > 0 && !isPayrollClosed;

  const openPaymentDraftForRun = async (run: PayrollRun) => {
    if (run.status !== "approved") {
      notify("Payroll run must be approved before registering a payment.", {
        type: "warning",
      });
      return;
    }

    try {
      const existingPayments = await dataProvider.getList("payments", {
        filter: {
          payroll_run_id: run.id,
          category: run.category,
          pay_period_start: run.pay_period_start,
          pay_period_end: run.pay_period_end,
          pay_date: run.payday,
        },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "DESC" },
      });

      const existing = existingPayments.data[0];
      if (existing?.id != null) {
        const generated = await dataProvider.generatePaymentLines(existing.id);
        notify(
          generated > 0
            ? `Updated payment with ${generated} lines`
            : "Opening your payment record.",
        );
        redirect(
          createPath({ resource: "payments", id: existing.id, type: "show" }),
        );
        return;
      }

      const created = await dataProvider.create("payments", {
        data: {
          org_id: run.org_id,
          payroll_run_id: run.id,
          run_name: `Payroll · ${run.category}`,
          category: run.category,
          pay_period_start: run.pay_period_start,
          pay_period_end: run.pay_period_end,
          pay_date: run.payday,
          status: "draft",
          created_by: run.created_by ?? "Current User",
          notes: `Created from payroll run #${run.id}`,
        },
      });

      const generated = await dataProvider.generatePaymentLines(
        created.data.id,
      );
      notify(
        generated > 0
          ? `Payment created with ${generated} lines — next: mark as paid when money goes out`
          : "Payment created — next: mark as paid when money goes out",
      );
      redirect(
        createPath({ resource: "payments", id: created.data.id, type: "show" }),
      );
    } catch {
      notify("Could not create or open payment from payroll run", {
        type: "error",
      });
    }
  };

  const approveAndRegisterPayment = async () => {
    if (lineCount === 0) {
      notify("Build payroll lines first (button above), then approve.", {
        type: "warning",
      });
      return;
    }
    if (
      record.status === "cancelled" ||
      record.status === "paid" ||
      paymentIsPaid
    ) {
      return;
    }

    try {
      let run: PayrollRun = record;
      if (record.status !== "approved") {
        await update(
          "payroll_runs",
          {
            id: record.id,
            data: {
              status: "approved",
              approved_at: new Date().toISOString(),
            },
            previousData: record,
          },
          { returnPromise: true },
        );
        run = {
          ...record,
          status: "approved",
          approved_at: new Date().toISOString(),
        };
        notify("Payroll run approved");
        refresh();
      }
      await openPaymentDraftForRun(run);
    } catch {
      notify("Could not approve run or open payment", { type: "error" });
    }
  };

  const updateStatus = async (status: PayrollRun["status"]) => {
    if (status === "reviewed" && !canReview) {
      notify("Build payroll lines before marking the run as reviewed.", {
        type: "warning",
      });
      return;
    }

    if (status === "approved" && !canApprove) {
      notify("A payroll run needs generated lines before it can be approved", {
        type: "warning",
      });
      return;
    }

    if (status === "paid") {
      notify(
        "Close payroll from Payments. Payroll runs should stop at approved.",
        {
          type: "warning",
        },
      );
      return;
    }

    try {
      await update(
        "payroll_runs",
        {
          id: record.id,
          data: {
            status,
            approved_at:
              status === "approved"
                ? new Date().toISOString()
                : (record.approved_at ?? null),
            paid_at:
              status === "paid"
                ? new Date().toISOString()
                : (record.paid_at ?? null),
          },
          previousData: record,
        },
        {
          returnPromise: true,
        },
      );
      notify(`Payroll run marked as ${status}`);
      refresh();
    } catch {
      notify("Could not update payroll run status", { type: "error" });
    }
  };

  const confirmCancelPayrollRun = async () => {
    const trimmed = cancelReason.trim();
    if (trimmed.length < 5) {
      notify("Add a short reason (why you are cancelling this run).", {
        type: "warning",
      });
      return;
    }
    try {
      await update(
        "payroll_runs",
        {
          id: record.id,
          data: {
            status: "cancelled",
            cancellation_reason: trimmed,
          },
          previousData: record,
        },
        { returnPromise: true },
      );
      setCancelDialogOpen(false);
      setCancelReason("");
      notify(
        "Run cancelled. Hours on this run return to Approved — open Hours to correct entries if needed.",
      );
      refresh();
    } catch {
      notify("Could not cancel payroll run", { type: "error" });
    }
  };

  const generateLines = async () => {
    setIsGenerating(true);
    try {
      const created = await dataProvider.generatePayrollRun(record.id);
      notify(
        `Payroll refreshed from current hours and loans (${created ?? 0} lines)`,
      );
      refresh();
    } catch {
      notify("Could not refresh payroll from current hours and loans", {
        type: "error",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isPayrollClosed) {
    return null;
  }

  const payInPaymentsLabel =
    record.status === "approved"
      ? "Pay in Payments"
      : "Approve & pay in Payments";

  const buildDisabled = !canGenerate || isUpdating || isGenerating;
  const primaryPayDisabled =
    !canApproveAndRegister || isUpdating || isGenerating;

  return (
    <>
      <Dialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          setCancelDialogOpen(open);
          if (!open) setCancelReason("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this payroll run?</DialogTitle>
            <DialogDescription asChild>
              <span>
                Linked hours will go back to <strong>Approved</strong> so you
                can fix typos, days, or other mistakes. This cannot be undone
                from here (create a new run when ready).
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label
              htmlFor="payroll-cancel-reason"
              className="text-sm font-medium leading-none"
            >
              Reason for cancellation{" "}
              <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="payroll-cancel-reason"
              placeholder="e.g. Wrong dates in the period — need to rebuild lines"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={4}
              className="resize-y"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isUpdating}
              onClick={() => void confirmCancelPayrollRun()}
            >
              {isUpdating ? "Cancelling…" : "Cancel run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div className="flex w-full flex-col items-stretch gap-2 sm:items-end">
          {lineCount === 0 ? (
            <p className="max-w-xl text-right text-xs leading-relaxed text-muted-foreground sm:mr-auto sm:text-left">
              <span className="font-medium text-foreground">Step 1:</span> build
              lines from approved hours and loans. Then approve and pay.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {lineCount === 0 ? (
              <Button
                type="button"
                disabled={buildDisabled}
                title="Creates payroll lines from hours and loans for this period."
                onClick={() => void generateLines()}
              >
                {isGenerating ? (
                  <Loader2
                    className="mr-2 h-4 w-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                ) : null}
                Build payroll lines
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  disabled={primaryPayDisabled}
                  title={
                    record.status === "approved"
                      ? "Open or create this run’s payment record in Payments, then mark as paid when funds go out."
                      : "Approve this run and go to Payments to register the payout."
                  }
                  onClick={() => void approveAndRegisterPayment()}
                >
                  <Banknote className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                  {payInPaymentsLabel}
                </Button>
                <Button variant="outline" type="button" asChild>
                  <Link
                    to={createPath({ resource: "payments", type: "list" })}
                    title="Open the Payments list"
                  >
                    Payments
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={buildDisabled}
                  title="Rebuild lines if hours or loans changed."
                  onClick={() => void generateLines()}
                >
                  {isGenerating ? (
                    <Loader2
                      className="mr-2 h-4 w-4 shrink-0 animate-spin"
                      aria-hidden
                    />
                  ) : null}
                  Refresh lines
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="More payroll actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[12rem]">
                {lineCount > 0 ? (
                  <>
                    <DropdownMenuLabel className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
                      Optional
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      disabled={!canReview || isUpdating || isGenerating}
                      onClick={() => void updateStatus("reviewed")}
                    >
                      Mark as reviewed
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canApprove || isUpdating || isGenerating}
                      onClick={() => void updateStatus("approved")}
                    >
                      Approve without opening Payments
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link
                    to={`/time_entries?payroll_run_id=${record.id}`}
                    title="Opens Hours filtered to time entries on this payroll run"
                  >
                    Review hours (this run)
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!canCancel || isUpdating || isGenerating}
                  className="text-destructive focus:text-destructive"
                  onClick={() => setCancelDialogOpen(true)}
                >
                  Cancel run…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </>
  );
};

/** Used by the full page and the payroll list popup — expects `Show` or `ShowBase` for record context. */
export const PayrollRunsShowContent = ({
  variant = "page",
}: {
  variant?: "page" | "dialog";
} = {}) => {
  const record = useRecordContext<PayrollRun>();
  const createPath = useCreatePath();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [isRepairingRelease, setIsRepairingRelease] = useState(false);

  const pendingHoursEditPath = useMemo(() => {
    if (!record) return "/time_entries?focus=pending_payroll";
    return record.employee_id != null
      ? `/time_entries?person_id=${String(record.employee_id)}&focus=pending_payroll`
      : `/time_entries?focus=pending_payroll`;
  }, [record]);

  const { data: lines = [] } = useGetList<PayrollRunLine>(
    "payroll_run_lines",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
      filter: { payroll_run_id: record?.id },
    },
    { enabled: Boolean(record?.id) },
  );

  const { total: stuckHoursOnRunTotal } = useGetList<TimeEntry>(
    "time_entries",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
      filter:
        record?.id != null && record.status === "cancelled"
          ? { payroll_run_id: record.id }
          : { id: -1 },
    },
    { enabled: Boolean(record?.status === "cancelled" && record?.id) },
  );
  const { data: linkedPayList = [] } = useGetList<Payment>(
    "payments",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "DESC" },
      filter: record?.id != null ? { payroll_run_id: record.id } : { id: -1 },
    },
    { enabled: Boolean(record?.id) },
  );
  const linkedPayment = linkedPayList[0];

  const effectivePaidAt = useMemo(() => {
    if (!record) return null;
    if (record.paid_at) return record.paid_at;
    if (linkedPayment?.status === "paid" && linkedPayment.paid_at) {
      return linkedPayment.paid_at;
    }
    return null;
  }, [record, linkedPayment]);

  const isPayrollClosed = useMemo(() => {
    if (!record) return false;
    return (
      record.status === "paid" ||
      record.status === "cancelled" ||
      linkedPayment?.status === "paid"
    );
  }, [record, linkedPayment]);

  const { data: employee } = useGetOne<Person>(
    "people",
    { id: record?.employee_id ?? "" },
    { enabled: Boolean(record?.employee_id) },
  );
  const employeeName =
    record.employee_id != null
      ? employee
        ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
        : `Employee #${record.employee_id}`
      : "All employees";

  const repairStuckCancelledRun = async () => {
    if (!record?.id) return;
    setIsRepairingRelease(true);
    try {
      await dataProvider.releasePayrollRunLinkedResources(record.id);
      notify(
        "Cleanup finished. Hours should be Approved again — refresh Hours if you still see old labels.",
        { type: "success" },
      );
      refresh();
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Could not release hours for this run",
        { type: "error" },
      );
    } finally {
      setIsRepairingRelease(false);
    }
  };

  if (!record) return null;

  const isDialog = variant === "dialog";

  return (
    <div className={cn("space-y-6", isDialog && "space-y-5")}>
      <div className={cn("px-5", isDialog ? "pt-5 pb-0" : "pt-4 pb-0")}>
        <header className="space-y-4">
          {!isDialog ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Link
                to="/payroll_runs"
                className="transition-colors hover:text-slate-900"
              >
                Payroll
              </Link>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="text-slate-900">Run #{record.id}</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="text-slate-900">{employeeName}</span>
            </div>
          ) : null}

          <div className="space-y-3">
            {isDialog ? (
              <>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Payroll run #{record.id}
                </h1>
                <p className="text-sm text-muted-foreground">{employeeName}</p>
              </>
            ) : (
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Payroll Run Details #{record.id} - {employeeName}
              </h1>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <PayrollRunHeaderBadges
                record={record}
                employeeName={employeeName}
                linkedPayment={linkedPayment}
              />
            </div>
          </div>

          <div
            className="-mx-1 flex flex-nowrap items-baseline gap-x-5 gap-y-1 overflow-x-auto px-1 pb-0.5 text-sm"
            title="Payroll run details"
          >
            <span className="shrink-0">
              <span className="text-muted-foreground">Period</span>{" "}
              <span className="text-foreground">
                {formatDate(record.pay_period_start)} –{" "}
                {formatDate(record.pay_period_end)}
              </span>
            </span>
            <span className="shrink-0 text-muted-foreground/50" aria-hidden>
              ·
            </span>
            <span className="shrink-0">
              <span className="text-muted-foreground">Created by</span>{" "}
              <span className="text-foreground">
                {record.created_by ?? "—"}
              </span>
            </span>
            <span className="shrink-0 text-muted-foreground/50" aria-hidden>
              ·
            </span>
            <span className="shrink-0 whitespace-nowrap">
              <span className="text-muted-foreground">Created</span>{" "}
              <span className="tabular-nums text-foreground">
                {formatDateTime(record.created_at ?? null)}
              </span>
            </span>
            <span className="shrink-0 text-muted-foreground/50" aria-hidden>
              ·
            </span>
            <span className="shrink-0 whitespace-nowrap">
              <span className="text-muted-foreground">Approved</span>{" "}
              <span className="tabular-nums text-foreground">
                {record.approved_at ? formatDateTime(record.approved_at) : "—"}
              </span>
            </span>
            <span className="shrink-0 text-muted-foreground/50" aria-hidden>
              ·
            </span>
            <span className="shrink-0 whitespace-nowrap">
              <span className="text-muted-foreground">Paid</span>{" "}
              <span className="tabular-nums text-foreground">
                {effectivePaidAt ? formatDateTime(effectivePaidAt) : "—"}
              </span>
              {linkedPayment?.id ? (
                <>
                  {" "}
                  <Link
                    to={createPath({
                      resource: "payments",
                      id: linkedPayment.id,
                      type: "show",
                    })}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Payment #{linkedPayment.id}
                  </Link>
                </>
              ) : null}
            </span>
          </div>
        </header>

        {record.status === "cancelled" && record.cancellation_reason ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="rounded-md border border-rose-200 bg-rose-50/90 px-3 py-2 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
              <span className="font-semibold">Cancellation reason: </span>
              {record.cancellation_reason}
            </p>
          </div>
        ) : null}
        {record.notes ? (
          <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
            {record.notes}
          </p>
        ) : null}
      </div>

      <div
        className={cn("space-y-4 px-5", isDialog ? "pb-5 pt-0" : "pb-6 pt-0")}
      >
        <IncludedHoursTable
          payrollRun={record}
          lines={lines}
          isPayrollClosed={isPayrollClosed}
          variant={variant}
        />
        {isPayrollClosed ? (
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {linkedPayment?.status === "paid" ? (
              <>
                This payroll is <strong>closed</strong> — payment was recorded
                {effectivePaidAt ? ` on ${formatDate(effectivePaidAt)}` : ""}.
              </>
            ) : record.status === "cancelled" ? (
              <span className="flex flex-col gap-3">
                <span className="block space-y-2">
                  <span className="block">
                    This payroll run was cancelled. Hours that were on this run
                    should appear again under{" "}
                    <strong className="text-foreground">Approved</strong> in
                    Hours so you can correct mistakes.
                  </span>
                  <Link
                    to={pendingHoursEditPath}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Open Hours (approved, not on a run)
                  </Link>
                </span>
                <div className="rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50">
                  <p className="mb-2 text-xs leading-relaxed">
                    If hours still show as{" "}
                    <strong className="font-medium">included in payroll</strong>{" "}
                    (for example the run was cancelled before the database was
                    updated), run this cleanup to send them back to Approved.
                    {(stuckHoursOnRunTotal ?? 0) > 0 || lines.length > 0 ? (
                      <>
                        {" "}
                        <span className="font-medium text-amber-900 dark:text-amber-100">
                          Stuck data detected for this run — use the button
                          below.
                        </span>
                      </>
                    ) : null}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isRepairingRelease}
                    onClick={() => void repairStuckCancelledRun()}
                  >
                    {isRepairingRelease ? "Working…" : "Release hours again"}
                  </Button>
                </div>
              </span>
            ) : (
              <>This payroll run is closed.</>
            )}
          </p>
        ) : (
          <div className="max-w-2xl space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {lines.length === 0 ? (
                <>
                  <span className="font-medium text-foreground">Next:</span> use{" "}
                  <span className="font-medium text-foreground">
                    Build payroll lines
                  </span>{" "}
                  above, then{" "}
                  <span className="font-medium text-foreground">
                    Approve &amp; pay in Payments
                  </span>
                  . Extra options stay under{" "}
                  <span className="font-medium text-foreground">⋯</span>.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">Flow:</span>{" "}
                  confirm totals (use{" "}
                  <span className="font-medium text-foreground">
                    Refresh lines
                  </span>{" "}
                  if hours changed), then{" "}
                  <span className="font-medium text-foreground">
                    Approve &amp; pay in Payments
                  </span>
                  . On the payment screen,{" "}
                  <span className="font-medium text-foreground">
                    mark as paid
                  </span>{" "}
                  when the money has actually left your account.
                </>
              )}
            </p>
            {linkedPayment?.id != null && linkedPayment.status !== "paid" ? (
              <p className="rounded-md border border-sky-200 bg-sky-50/90 px-3 py-2 text-xs leading-relaxed text-sky-950 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-50">
                <span className="font-semibold">Record the payout:</span> open{" "}
                <Link
                  to={createPath({
                    resource: "payments",
                    id: linkedPayment.id,
                    type: "show",
                  })}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  payment #{linkedPayment.id}
                </Link>{" "}
                and choose <strong>mark as paid</strong> after you pay people in
                real life.
              </p>
            ) : null}
          </div>
        )}
        <div className="flex justify-end">
          <PayrollRunActions
            lineCount={lines.length}
            linkedPayment={linkedPayment}
          />
        </div>
      </div>
    </div>
  );
};

export const PayrollRunsShow = () => (
  <Show actions={false} title={false} className="my-0">
    <PayrollRunsShowContent />
  </Show>
);
