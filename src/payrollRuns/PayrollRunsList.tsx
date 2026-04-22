import { useMemo, useState } from "react";
import {
  type Identifier,
  useGetIdentity,
  useGetList,
  useGetOne,
  useListContext,
  useListFilterContext,
  useRecordContext,
  RecordContextProvider,
  useStore,
} from "ra-core";
import { Link } from "react-router";
import {
  ClipboardList,
  PanelLeftClose,
  PanelRightOpen,
  Search,
} from "lucide-react";
import { DateField, List, ListPagination } from "@/components/admin";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  Payment,
  PayrollRun,
  Person,
  TimeEntry,
} from "@/components/atomic-crm/types";
import { cn } from "@/lib/utils";
import { canUseCrmPermission } from "@/components/atomic-crm/providers/commons/crmPermissions";
import { getPersonCompensationProfile } from "@/payroll/rules";
import { getPayrollRunListStatusDisplay } from "./payrollRunListStatus";
import { formatMoney } from "@/people/constants";
import { PaymentsListContent } from "@/payments";
import { PayrollRunDetailDialog } from "./PayrollRunDetailDialog";
import {
  PayrollApprovedHoursReviewDialog,
  type PayrollReviewTarget,
} from "./PayrollApprovedHoursReviewDialog";
import { usePayrollPendingQueueRows } from "./usePayrollPendingQueueRows";

const getPayrollLabelForPerson = (person: Person) =>
  `${person.first_name} ${person.last_name}`;

const getPayrollSubtitleForPerson = (person: Person) => {
  const profile = getPersonCompensationProfile(person);
  if (person.type === "subcontractor") return "Subcontractor";
  if (profile.unit === "week" || profile.unit === "month") return "Salary";
  if (profile.unit === "commission") return "Commission";
  return "Hourly";
};

const getPayrollBadgeClassName = (typeLabel: string, isActive: boolean) => {
  if (typeLabel === "Salary") {
    return isActive
      ? "border-emerald-300 bg-emerald-600 text-white"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (typeLabel === "Commission") {
    return isActive
      ? "border-amber-300 bg-amber-500 text-white"
      : "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (typeLabel === "Subcontractor") {
    return isActive
      ? "border-slate-300 bg-slate-700 text-white"
      : "border-slate-200 bg-slate-100 text-slate-700";
  }
  return isActive
    ? "border-sky-300 bg-sky-600 text-white"
    : "border-sky-200 bg-sky-50 text-sky-700";
};

const PayrollRunsActions = () => {
  const { filterValues } = useListFilterContext();
  const { data: identity } = useGetIdentity();
  const selectedEmployeeId =
    filterValues.employee_id == null ? null : String(filterValues.employee_id);
  const canManagePayroll = canUseCrmPermission(
    identity as any,
    "payments.manage",
  );

  return (
    <TopToolbar className="-mx-1 w-auto flex-wrap justify-end gap-2">
      {canManagePayroll ? (
        <Button asChild>
          <Link
            to={
              selectedEmployeeId
                ? `/payroll_runs/create?employee_id=${selectedEmployeeId}`
                : "/payroll_runs/create"
            }
          >
            {selectedEmployeeId
              ? "New Payroll For Employee"
              : "New Payroll Run"}
          </Link>
        </Button>
      ) : null}
      <ModuleInfoPopover
        title="Payroll"
        description="Payroll runs are the official cycle for a period: they roll up approved hours and salaries, apply loan repayments, and track status through paid."
        bullets={[
          "Approved hours: click a row to review — then create a run; register payout in Payments when ready.",
          "Payroll runs: saved periods — open a row for detail.",
          "Payments tab: payment runs and lines (same as the full Payments flow).",
        ]}
        contextTitle="Typical flow"
        contextDescription={
          <>
            Approve hours in <strong>Hours</strong>, then check the{" "}
            <strong>Approved hours</strong> tab. Create a run from there or from
            the <strong>Payroll runs</strong> tab. When you have paid people
            outside the app, <strong>register</strong> that payout in the{" "}
            <strong>Payments</strong> tab to close the batch and keep a record.
            Loans deduct on payroll when active.
          </>
        }
      />
    </TopToolbar>
  );
};

const PayrollScopeField = () => {
  const record = useRecordContext<PayrollRun>();
  const employeeId = record?.employee_id;
  const { data: employee } = useGetOne<Person>(
    "people",
    { id: employeeId ?? "" },
    { enabled: Boolean(employeeId) },
  );

  if (!employeeId) return <span>All employees</span>;
  return (
    <span>
      {employee
        ? `${employee.first_name} ${employee.last_name}`
        : `Employee #${employeeId}`}
    </span>
  );
};

const TAB_APPROVED = "approved-hours";
const TAB_RUNS = "payroll-runs";
const TAB_PAYMENTS = "payments";

const PayrollRunsTable = () => {
  const [mainTab, setMainTab] = useState<string>(TAB_APPROVED);
  const [reviewTarget, setReviewTarget] = useState<PayrollReviewTarget | null>(
    null,
  );
  const [payrollRunDetailId, setPayrollRunDetailId] =
    useState<Identifier | null>(null);
  const { filterValues } = useListFilterContext();
  const {
    data: runs = [],
    isPending: runsLoading,
    total = 0,
  } = useListContext<PayrollRun>();
  const { rows: queueRows, loading: queueLoading } =
    usePayrollPendingQueueRows();
  const showScopeColumn =
    filterValues.employee_id == null || filterValues.employee_id === "";

  const { data: payments = [] } = useGetList<Payment>(
    "payments",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "DESC" },
    },
    { staleTime: 20_000 },
  );
  const paymentRunCount = payments.length;

  const paymentByRunId = useMemo(() => {
    const m = new Map<number, Payment>();
    for (const p of payments) {
      const rid = p.payroll_run_id;
      if (rid == null) continue;
      const n = Number(rid);
      if (!m.has(n)) m.set(n, p);
    }
    return m;
  }, [payments]);

  const queueColCount = 7;
  const runsColCount = showScopeColumn ? 8 : 7;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-background">
      <div
        className="flex flex-col gap-3 border-b bg-muted/15 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
        id="payroll-unified-heading"
      >
        <div className="flex min-w-0 items-start gap-2">
          <ClipboardList
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">Payroll</h2>
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              <strong>Approved hours</strong> → <strong>Payroll runs</strong> →{" "}
              <strong>Payments</strong>: queue, close periods, then{" "}
              <strong>register</strong> payouts.
            </p>
          </div>
        </div>
      </div>

      <Tabs
        value={mainTab}
        onValueChange={setMainTab}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="border-b px-3 py-2">
          <TabsList className="h-auto min-h-9 w-full flex-wrap justify-start sm:w-auto">
            <TabsTrigger value={TAB_APPROVED} className="gap-1.5">
              Approved hours
              {queueRows.length > 0 ? (
                <Badge
                  variant="secondary"
                  className="px-1.5 py-0 text-[10px] font-medium tabular-nums"
                >
                  {queueRows.length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value={TAB_RUNS} className="gap-1.5">
              Payroll runs
              {total > 0 ? (
                <Badge
                  variant="outline"
                  className="px-1.5 py-0 text-[10px] font-medium tabular-nums"
                >
                  {total}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value={TAB_PAYMENTS} className="gap-1.5">
              Payments
              {paymentRunCount > 0 ? (
                <Badge
                  variant="outline"
                  className="px-1.5 py-0 text-[10px] font-medium tabular-nums"
                >
                  {paymentRunCount}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value={TAB_APPROVED}
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <Table className="min-w-[40rem]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Employee</TableHead>
                  <TableHead>Date range</TableHead>
                  <TableHead className="text-right">Reg</TableHead>
                  <TableHead className="text-right">OT</TableHead>
                  <TableHead className="text-right">Paid leave</TableHead>
                  <TableHead className="text-right">Est. gross</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueLoading ? (
                  <TableRow>
                    <TableCell colSpan={queueColCount}>
                      <div className="space-y-2 py-3">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : queueRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={queueColCount}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Nothing in the queue. Approve time in{" "}
                      <Link
                        to="/time_entries"
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        Hours
                      </Link>{" "}
                      — only <strong>approved</strong> hours still waiting for a
                      payroll run appear here.
                    </TableCell>
                  </TableRow>
                ) : (
                  queueRows.map((row) => (
                    <TableRow
                      key={`queue-${row.personId}`}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer bg-muted/15 hover:bg-muted/40"
                      onClick={() =>
                        setReviewTarget({
                          personId: row.personId,
                          name: row.name,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setReviewTarget({
                            personId: row.personId,
                            name: row.name,
                          });
                        }
                      }}
                    >
                      <TableCell className="max-w-[14rem] font-medium">
                        {row.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {row.from === row.to
                          ? row.from
                          : `${row.from} → ${row.to}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {row.regular.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {row.overtime.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {row.paidLeave.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium tabular-nums">
                        {formatMoney(row.estimatedGross)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="px-2 py-0 text-[10px] font-medium normal-case tracking-normal"
                        >
                          Pending run
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {queueRows.length > 0 ? (
            <p className="shrink-0 border-t px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Click a row to review lines and continue to a payroll run;
              register the payout in Payments after the run is approved. Est.
              gross uses each person&apos;s pay rules (same idea as generating a
              payroll run). Purely salaried staff with <strong>no</strong>{" "}
              approved time rows won&apos;t appear here—they are still added
              when you generate a run for the period.
            </p>
          ) : null}
        </TabsContent>

        <PayrollApprovedHoursReviewDialog
          target={reviewTarget}
          onOpenChange={(next) => {
            if (!next) setReviewTarget(null);
          }}
        />

        <PayrollRunDetailDialog
          runId={payrollRunDetailId}
          open={payrollRunDetailId != null}
          onOpenChange={(next) => {
            if (!next) setPayrollRunDetailId(null);
          }}
        />

        <TabsContent
          value={TAB_RUNS}
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <Table className="min-w-[52rem]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Run</TableHead>
                  {showScopeColumn ? <TableHead>Scope</TableHead> : null}
                  <TableHead>Pay period</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Payday</TableHead>
                  <TableHead>Payment status</TableHead>
                  <TableHead>Created by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsLoading ? (
                  <TableRow>
                    <TableCell colSpan={runsColCount}>
                      <div className="space-y-2 py-3">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : runs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={runsColCount}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No payroll runs yet. Create one from the toolbar or from
                      the Approved hours tab.
                    </TableCell>
                  </TableRow>
                ) : (
                  runs.map((record) => {
                    const payment = paymentByRunId.get(Number(record.id));
                    const { label, badgeClassName } =
                      getPayrollRunListStatusDisplay(record, payment);
                    return (
                      <TableRow
                        key={`run-${record.id}`}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setPayrollRunDetailId(record.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setPayrollRunDetailId(record.id);
                          }
                        }}
                      >
                        <TableCell className="max-w-[10rem] font-medium">
                          #{record.id}
                        </TableCell>
                        {showScopeColumn ? (
                          <TableCell>
                            <RecordContextProvider value={record}>
                              <PayrollScopeField />
                            </RecordContextProvider>
                          </TableCell>
                        ) : null}
                        <TableCell className="whitespace-nowrap text-xs">
                          <DateField
                            record={record}
                            source="pay_period_start"
                          />{" "}
                          <span className="text-muted-foreground">–</span>{" "}
                          <DateField record={record} source="pay_period_end" />
                        </TableCell>
                        <TableCell className="text-xs capitalize">
                          {record.category}
                        </TableCell>
                        <TableCell className="text-xs capitalize">
                          {record.pay_schedule}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          <DateField record={record} source="payday" />
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "px-2 py-0 text-[10px] font-medium normal-case tracking-normal",
                              badgeClassName,
                            )}
                          >
                            {label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {record.created_by ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="shrink-0 border-t bg-background px-2 py-2">
            <ListPagination rowsPerPageOptions={[10, 15, 20]} />
          </div>
        </TabsContent>

        <TabsContent
          value={TAB_PAYMENTS}
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
            {mainTab === TAB_PAYMENTS ? <PaymentsListContent embedded /> : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const EmployeesQuickNavigation = () => {
  const [query, setQuery] = useState("");
  const [minimized, setMinimized] = useStore<boolean>(
    "app.preferences.payrollRunsEmployeesExplorerMinimized",
    false,
  );
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const activeEmployeeId = filterValues.employee_id
    ? Number(filterValues.employee_id)
    : null;

  const { data: employees = [], isPending } = useGetList<Person>(
    "people",
    {
      pagination: { page: 1, perPage: 2000 },
      sort: { field: "first_name", order: "ASC" },
      filter: { status: "active" },
    },
    { staleTime: 30_000 },
  );
  const { data: pendingEntries = [], isPending: pendingEntriesLoading } =
    useGetList<TimeEntry>(
      "time_entries",
      {
        pagination: { page: 1, perPage: 5000 },
        sort: { field: "date", order: "DESC" },
        filter: { "status@in": "(approved,included_in_payroll)" },
      },
      { staleTime: 30_000 },
    );

  const pendingEmployeeIds = useMemo(
    () =>
      new Set(
        pendingEntries.map((entry) => Number(entry.person_id)).filter(Boolean),
      ),
    [pendingEntries],
  );

  const payrollEligibleEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        const profile = getPersonCompensationProfile(employee);
        const hasRecurringPayroll =
          profile.unit === "week" || profile.unit === "month";
        return (
          hasRecurringPayroll || pendingEmployeeIds.has(Number(employee.id))
        );
      }),
    [employees, pendingEmployeeIds],
  );

  const filteredEmployees = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return payrollEligibleEmployees;
    return payrollEligibleEmployees.filter((employee) => {
      const name = getPayrollLabelForPerson(employee).toLowerCase();
      const email = String(employee.email ?? "").toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [payrollEligibleEmployees, query]);

  const selectEmployee = (employeeId?: number) => {
    const nextFilterValues = { ...filterValues };
    if (!employeeId) {
      delete nextFilterValues.employee_id;
    } else {
      nextFilterValues.employee_id = employeeId;
    }
    setFilters(nextFilterValues, displayedFilters);
  };

  if (minimized) {
    return (
      <aside className="hidden h-full min-h-0 w-12 shrink-0 self-start xl:flex flex-col items-center py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMinimized(false)}
          aria-label="Expand employees panel"
          title="Expand employees panel"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        <span className="mt-4 rotate-180 text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
          Employees
        </span>
      </aside>
    );
  }

  return (
    <aside className="hidden h-full min-h-0 w-[20rem] shrink-0 self-start xl:flex flex-col">
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Employees</h3>
            <p className="text-xs text-muted-foreground">Quick navigation</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMinimized(true)}
            aria-label="Minimize employees panel"
            title="Minimize employees panel"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search employees (${payrollEligibleEmployees.length})`}
            className="h-9 pl-8"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <button
          type="button"
          className={cn(
            "mb-1.5 w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-all hover:bg-muted/60",
            activeEmployeeId == null &&
              "border-primary/50 bg-secondary/70 shadow-sm ring-1 ring-primary/10",
          )}
          onClick={() => selectEmployee(undefined)}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">All employees</span>
            <Badge
              variant="secondary"
              className="px-2 py-0 text-[10px] uppercase tracking-wide"
            >
              All payroll
            </Badge>
          </div>
        </button>
        {isPending || pendingEntriesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="px-1 py-2 text-sm text-muted-foreground">
            No employees found.
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredEmployees.map((employee) => {
              const isActive = Number(employee.id) === activeEmployeeId;
              const typeLabel = getPayrollSubtitleForPerson(employee);
              return (
                <button
                  key={employee.id}
                  type="button"
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-all hover:bg-muted/60",
                    isActive &&
                      "border-primary/50 bg-secondary/70 shadow-sm ring-1 ring-primary/10",
                  )}
                  onClick={() => selectEmployee(Number(employee.id))}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {getPayrollLabelForPerson(employee)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {employee.email || "No email"}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 px-2 py-0 text-[10px] uppercase tracking-wide",
                        getPayrollBadgeClassName(typeLabel, isActive),
                      )}
                    >
                      {typeLabel}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};

export const PayrollRunsList = () => (
  <List
    title={false}
    disableBreadcrumb
    sort={{ field: "payday", order: "DESC" }}
    perPage={20}
    actions={<PayrollRunsActions />}
    pagination={false}
    contentScrollable={false}
  >
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <EmployeesQuickNavigation />
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <PayrollRunsTable />
        </div>
      </div>
    </div>
  </List>
);
