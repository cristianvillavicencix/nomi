import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  useGetList,
  useGetIdentity,
  useGetOne,
  useListContext,
  useListFilterContext,
  useNotify,
  useRecordContext,
  useRefresh,
  useStore,
  useUpdateMany,
} from "ra-core";
import {
  CheckCheck,
  PanelLeftClose,
  PanelRightOpen,
  Search,
} from "lucide-react";
import { useSearchParams } from "react-router";
import {
  DataTable,
  ExportButton,
  List,
  BulkDeleteButton,
  ListPagination,
  ReferenceField,
} from "@/components/admin";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Person, TimeEntry } from "@/components/atomic-crm/types";
import { cn } from "@/lib/utils";
import { canUseCrmPermission } from "@/components/atomic-crm/providers/commons/crmPermissions";
import { canApprovePayroll } from "@/payroll/permissions";
import { formatMoney } from "@/people/constants";
import { TimeEntriesBulkCreateModal } from "./TimeEntriesBulkCreateModal";
import { employeeOptionText, enWeekdayShort } from "./helpers";
import {
  PayrollFlowField,
  TimeEntryPipelineProvider,
} from "./timeEntryPayrollFlow";

/**
 * Applies URL query params to list filters:
 * - `?payroll_run_id=` — only time entries attached to that payroll run (from payroll run / payment links).
 * - `?person_id=` + `?focus=pending_payroll` — approved hours not yet on a run for that person.
 */
const TimeEntriesQuerySync = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filterValues, setFilters, displayedFilters } = useListFilterContext();

  useLayoutEffect(() => {
    const payrollRunId = searchParams.get("payroll_run_id");
    if (payrollRunId != null && payrollRunId !== "") {
      const next: Record<string, unknown> = { ...filterValues };
      next.payroll_run_id = Number(payrollRunId);
      delete next.person_id;
      delete next.status;
      delete next["status@neq"];
      delete next["payroll_run_id@is"];
      setFilters(next as Record<string, unknown>, displayedFilters);
      return;
    }

    const personId = searchParams.get("person_id");
    const focus = searchParams.get("focus");
    if (!personId && focus !== "pending_payroll") return;

    const next: Record<string, unknown> = { ...filterValues };

    if (personId) {
      next.person_id = Number(personId);
    }

    if (focus === "pending_payroll") {
      next.status = "approved";
      delete next["status@neq"];
      next["payroll_run_id@is"] = null;
    }

    setFilters(next as Record<string, unknown>, displayedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the query string changes
  }, [searchParams.toString()]);

  /**
   * Remove one-shot query params after they are merged into list filters.
   * Otherwise flat `?person_id=` / `?payroll_run_id=` from links keeps winning over the sidebar.
   */
  useEffect(() => {
    const focus = searchParams.get("focus");
    const flatPerson = searchParams.get("person_id");
    const flatRun = searchParams.get("payroll_run_id");
    if (focus !== "pending_payroll" && flatPerson == null && flatRun == null) {
      return;
    }
    const params = new URLSearchParams(searchParams);
    if (focus === "pending_payroll") params.delete("focus");
    if (flatPerson != null) params.delete("person_id");
    if (flatRun != null) params.delete("payroll_run_id");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return null;
};

const statusChoices = [
  {
    id: "pending_payment",
    name: "Open — not paid yet",
  },
  { id: "draft", name: "Draft" },
  { id: "submitted", name: "Submitted" },
  { id: "approved", name: "Approved" },
  { id: "rejected", name: "Rejected" },
  { id: "included_in_payroll", name: "Included In Payroll" },
  { id: "paid", name: "Paid" },
  { id: "all", name: "All status" },
];

/** Non-status keys we keep when rebuilding the status filter (avoids conflicting status + status@neq). */
const TIME_ENTRY_LIST_FILTER_KEYS = [
  "person_id",
  "project_id",
  "date@gte",
  "date@lte",
  "payroll_run_id",
  "payroll_run_id@is",
] as const;

function pickPersistedTimeEntryFilters(
  filterValues: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const key of TIME_ENTRY_LIST_FILTER_KEYS) {
    const v = filterValues[key];
    if (v !== undefined && v !== "") next[key] = v;
  }
  return next;
}

type DatePreset =
  | "all"
  | "last_week"
  | "two_weeks_ago"
  | "this_month"
  | "custom";

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const startOfWeekMonday = (value: Date) => {
  const date = new Date(`${toIsoDate(value)}T00:00:00`);
  const day = date.getDay();
  const distance = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - distance);
  return date;
};

const getPresetRange = (preset: Exclude<DatePreset, "all" | "custom">) => {
  const today = new Date();
  if (preset === "this_month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toIsoDate(from), to: toIsoDate(today) };
  }

  const monday = startOfWeekMonday(today);
  if (preset === "last_week") {
    const from = new Date(monday);
    from.setDate(from.getDate() - 7);
    const to = new Date(monday);
    to.setDate(to.getDate() - 1);
    return { from: toIsoDate(from), to: toIsoDate(to) };
  }

  const from = new Date(monday);
  from.setDate(from.getDate() - 14);
  const to = new Date(monday);
  to.setDate(to.getDate() - 8);
  return { from: toIsoDate(from), to: toIsoDate(to) };
};

const TimeEntriesListActions = () => {
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const { data: identity } = useGetIdentity();
  const canManageHours = canUseCrmPermission(identity as any, "hours.manage");
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const { data: projects = [] } = useGetList<{
    id: number | string;
    name: string;
  }>(
    "deals",
    {
      pagination: { page: 1, perPage: 300 },
      sort: { field: "name", order: "ASC" },
      filter: { "archived_at@is": null },
    },
    { staleTime: 30_000 },
  );
  const { data: toolbarEmployees = [] } = useGetList<Person>(
    "people",
    {
      pagination: { page: 1, perPage: 2000 },
      sort: { field: "first_name", order: "ASC" },
      filter: { type: "employee", status: "active" },
    },
    { staleTime: 30_000 },
  );
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const selectedProjectId =
    filterValues.project_id == null ? "" : String(filterValues.project_id);
  const selectedPersonToolbarId =
    filterValues.person_id == null || filterValues.person_id === ""
      ? ""
      : String(filterValues.person_id);
  const selectedStatus = useMemo(() => {
    const pr = filterValues.payroll_run_id;
    if (pr != null && pr !== "" && !(typeof pr === "number" && pr === 0)) {
      return "all";
    }
    const st = filterValues.status;
    if (st != null && st !== "") return String(st);
    if (filterValues["status@neq"] === "paid") return "pending_payment";
    return "all";
  }, [filterValues]);

  useEffect(() => {
    const currentFrom =
      typeof filterValues["date@gte"] === "string"
        ? filterValues["date@gte"]
        : "";
    const currentTo =
      typeof filterValues["date@lte"] === "string"
        ? filterValues["date@lte"]
        : "";
    setCustomFrom(currentFrom);
    setCustomTo(currentTo);
    if (!currentFrom && !currentTo && datePreset !== "all") {
      setDatePreset("all");
    }
  }, [datePreset, filterValues]);

  const applyDateFilter = (from?: string, to?: string) => {
    const nextFilterValues = { ...filterValues };
    if (from) {
      nextFilterValues["date@gte"] = from;
    } else {
      delete nextFilterValues["date@gte"];
    }
    if (to) {
      nextFilterValues["date@lte"] = to;
    } else {
      delete nextFilterValues["date@lte"];
    }
    setFilters(nextFilterValues, displayedFilters);
  };

  const handlePresetChange = (value: DatePreset) => {
    setDatePreset(value);
    if (value === "all") {
      setCustomFrom("");
      setCustomTo("");
      applyDateFilter(undefined, undefined);
      return;
    }
    if (value === "custom") {
      if (customFrom && customTo) {
        applyDateFilter(customFrom, customTo);
      }
      return;
    }
    const range = getPresetRange(value);
    setCustomFrom(range.from);
    setCustomTo(range.to);
    applyDateFilter(range.from, range.to);
  };

  const handleCustomFromChange = (value: string) => {
    setDatePreset("custom");
    setCustomFrom(value);
    if (value && customTo) {
      applyDateFilter(value, customTo);
    }
  };

  const handleCustomToChange = (value: string) => {
    setDatePreset("custom");
    setCustomTo(value);
    if (customFrom && value) {
      applyDateFilter(customFrom, value);
    }
  };

  const handleProjectChange = (value: string) => {
    const nextFilterValues = { ...filterValues };
    if (!value) {
      delete nextFilterValues.project_id;
    } else {
      const asNumber = Number(value);
      nextFilterValues.project_id = Number.isNaN(asNumber) ? value : asNumber;
    }
    setFilters(nextFilterValues, displayedFilters);
  };

  const handleToolbarEmployeeChange = (value: string) => {
    const nextFilterValues = { ...filterValues };
    if (!value) {
      delete nextFilterValues.person_id;
    } else {
      const n = Number(value);
      nextFilterValues.person_id = Number.isNaN(n) ? value : n;
    }
    setFilters(nextFilterValues, displayedFilters);
  };

  const handleStatusChange = (value: string) => {
    const base = pickPersistedTimeEntryFilters(
      filterValues as Record<string, unknown>,
    );

    if (!value || value === "all") {
      // Only date / employee / project constraints — no status filter (show every status).
      setFilters(base, displayedFilters);
      return;
    }

    if (value === "pending_payment") {
      base["status@neq"] = "paid";
      setFilters(base, displayedFilters);
      return;
    }

    base.status = value;
    setFilters(base, displayedFilters);
  };

  return (
    <>
      <TopToolbar className="min-w-0 w-full max-w-full flex-wrap items-stretch justify-start gap-2 whitespace-normal sm:items-end sm:justify-end md:flex-nowrap md:overflow-x-auto md:pb-0.5">
        <select
          className="h-9 min-w-0 w-full max-w-full shrink rounded-md border border-input bg-background px-3 text-sm sm:w-[min(100%,220px)] sm:max-w-[220px] md:shrink-0 lg:max-w-[280px] lg:w-[min(100%,280px)]"
          value={selectedPersonToolbarId}
          onChange={(event) => handleToolbarEmployeeChange(event.target.value)}
          aria-label="Filter by employee"
        >
          <option value="">All employees</option>
          {toolbarEmployees.map((person) => (
            <option key={person.id} value={String(person.id)}>
              {employeeOptionText(person)}
            </option>
          ))}
        </select>
        <select
          className="h-9 min-w-0 w-full max-w-full shrink rounded-md border border-input bg-background px-3 text-sm sm:w-[min(100%,220px)] sm:max-w-[220px] md:shrink-0 lg:max-w-[280px] lg:w-[min(100%,280px)]"
          value={selectedProjectId}
          onChange={(event) => handleProjectChange(event.target.value)}
          aria-label="Filter by project"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={String(project.id)}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 w-full min-w-[8rem] shrink rounded-md border border-input bg-background px-3 text-sm sm:w-[140px] md:shrink-0"
          value={datePreset}
          onChange={(event) =>
            handlePresetChange(event.target.value as DatePreset)
          }
          aria-label="Date range preset"
        >
          <option value="all">All dates</option>
          <option value="last_week">Last week</option>
          <option value="two_weeks_ago">Two weeks ago</option>
          <option value="this_month">This month</option>
          <option value="custom">Custom range</option>
        </select>
        <Input
          type="date"
          className="h-9 w-full min-w-0 shrink sm:w-[150px] md:shrink-0"
          value={customFrom}
          onChange={(event) => handleCustomFromChange(event.target.value)}
          disabled={datePreset !== "custom"}
        />
        <Input
          type="date"
          className="h-9 w-full min-w-0 shrink sm:w-[150px] md:shrink-0"
          value={customTo}
          onChange={(event) => handleCustomToChange(event.target.value)}
          disabled={datePreset !== "custom"}
        />
        <select
          className="h-9 w-full min-w-[10rem] shrink rounded-md border border-input bg-background px-3 text-sm sm:w-[min(100%,200px)] md:w-[200px] md:shrink-0"
          value={selectedStatus}
          onChange={(event) => handleStatusChange(event.target.value)}
          aria-label="Entry status filter"
        >
          {statusChoices.map((status) => (
            <option key={status.id} value={status.id}>
              {status.name}
            </option>
          ))}
        </select>
        <ExportButton className="shrink-0" />
        {canManageHours ? (
          <Button
            type="button"
            className="shrink-0 whitespace-nowrap"
            onClick={() => setBulkModalOpen(true)}
          >
            New Time Entry
          </Button>
        ) : null}
        <div className="shrink-0">
          <ModuleInfoPopover
            title="Hours"
            description="Log work by person, project, and date. Entries must be approved before they can feed payroll or payment runs."
            bullets={[
              "Create or import entries for the correct day.",
              "Submit when ready; an approver reviews if your team uses that step.",
              "Approved entries can be included in Payroll or used when generating Payments.",
              "Payroll flow shows one status line for where this day is (Hours → payroll → payment → Paid), without links — open the row to go to details.",
            ]}
          />
        </div>
      </TopToolbar>
      <TimeEntriesBulkCreateModal
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
      />
    </>
  );
};

const BulkApproveButton = () => {
  const { selectedIds, data, onUnselectItems } = useListContext<TimeEntry>();
  const [updateMany, { isPending }] = useUpdateMany();
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();
  const canApprove = canUseCrmPermission(identity as any, "hours.approve");

  const draftIds = useMemo(
    () =>
      (selectedIds ?? []).filter((id) =>
        data?.some(
          (entry) =>
            entry.id === id &&
            (entry.status === "draft" || entry.status === "submitted"),
        ),
      ),
    [data, selectedIds],
  );

  const handleApprove = () => {
    if (!canApprove || !canApprovePayroll(identity)) {
      notify("Only owner/admin/accountant can approve time entries", {
        type: "error",
      });
      return;
    }
    if (!draftIds.length) {
      notify("Only draft entries can be approved", { type: "error" });
      return;
    }

    updateMany(
      "time_entries",
      {
        ids: draftIds,
        data: { status: "approved" },
        meta: { identity },
      },
      {
        onSuccess: () => {
          const skipped = (selectedIds?.length ?? 0) - draftIds.length;
          notify(
            skipped > 0
              ? `Approved ${draftIds.length} entries. ${skipped} skipped.`
              : "Time entries approved",
          );
          onUnselectItems?.();
          refresh();
        },
        onError: () => {
          notify("Could not approve time entries", { type: "error" });
        },
      },
    );
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleApprove}
      disabled={
        !selectedIds?.length ||
        isPending ||
        !canApprove ||
        !canApprovePayroll(identity)
      }
    >
      <CheckCheck className="h-4 w-4 mr-2" />
      Approve selected
    </Button>
  );
};

const formatTimeValue = (value?: string | null) => {
  if (!value) return "--:--";
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return "--:--";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
};

const DateWithWeekdayField = () => {
  const entry = useRecordContext<TimeEntry>();
  if (!entry?.date) return <span>—</span>;
  const weekday = enWeekdayShort(entry.date);
  return <span>{`${weekday} ${entry.date}`}</span>;
};

const getWeekendRowClassName = (entry: TimeEntry) => {
  if (!entry?.date) return "";
  const plain = entry.date.slice(0, 10);
  const parts = plain.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "";
  const [y, m, d] = parts;
  const day = new Date(y, m - 1, d).getDay();
  if (day === 6) {
    return "bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100/70 dark:hover:bg-blue-900/30";
  }
  if (day === 0) {
    return "bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/70 dark:hover:bg-rose-900/30";
  }
  return "";
};

const getPaymentStateRowClassName = (entry: TimeEntry) => {
  if (entry.status === "paid") {
    return "opacity-55 text-muted-foreground";
  }
  if (entry.status === "included_in_payroll") {
    return "bg-amber-50/40 dark:bg-amber-950/10";
  }
  return "";
};

const getTimeEntryRowClassName = (entry: TimeEntry) =>
  cn(getWeekendRowClassName(entry), getPaymentStateRowClassName(entry));

const StartTimeField = () => {
  const entry = useRecordContext<TimeEntry>();
  return <span>{formatTimeValue(entry?.start_time)}</span>;
};

const EndTimeField = () => {
  const entry = useRecordContext<TimeEntry>();
  return <span>{formatTimeValue(entry?.end_time)}</span>;
};

const LunchField = () => {
  const entry = useRecordContext<TimeEntry>();
  const lunchMinutes = Number(
    entry?.lunch_minutes ?? entry?.break_minutes ?? 0,
  );
  return <span>{lunchMinutes}</span>;
};

const DayTotalField = () => {
  const entry = useRecordContext<TimeEntry>();
  return <span>{Number(entry?.hours ?? 0).toFixed(2)}</span>;
};

const DAY_TYPE_LABELS: Record<
  NonNullable<TimeEntry["day_type"]>,
  string
> = {
  worked_day: "Worked Day",
  holiday: "Holiday",
  sick_day: "Sick Day",
  vacation_day: "Vacation Day",
  day_off: "Day Off",
  unpaid_leave: "Unpaid Leave",
};

const DayTypeField = () => {
  const entry = useRecordContext<TimeEntry>();
  if (!entry) return null;
  const key = entry.day_type ?? "worked_day";
  return <span>{DAY_TYPE_LABELS[key] ?? key}</span>;
};

const AddressField = () => {
  const entry = useRecordContext<TimeEntry>();
  if (!entry) return null;
  return <span>{entry.work_location ?? "-"}</span>;
};

const TotalPayField = () => {
  const entry = useRecordContext<TimeEntry>();
  const personId = entry?.person_id;
  const { data: person } = useGetOne<Person>(
    "people",
    { id: personId },
    { enabled: Boolean(personId) },
  );
  if (!entry || !person) return <span>$0.00</span>;
  const rate = Number(person.hourly_rate ?? 0);
  const overtimeMultiplier = Number(person.overtime_rate_multiplier ?? 1.5);
  const regular = Number(entry.regular_hours ?? entry.hours ?? 0);
  const overtime = Number(entry.overtime_hours ?? 0);
  const totalPay = regular * rate + overtime * rate * overtimeMultiplier;
  return <span>{formatMoney(totalPay)}</span>;
};

const EmployeeNameField = () => {
  const person = useRecordContext<Person>();
  if (!person) return null;
  return <span>{employeeOptionText(person)}</span>;
};

const TimeEntriesTable = () => {
  const { filterValues } = useListFilterContext();
  const { data: identity } = useGetIdentity();
  const showEmployeeColumn =
    filterValues.person_id == null || filterValues.person_id === "";
  const canManageHours = canUseCrmPermission(identity as any, "hours.manage");

  return (
    <TimeEntryPipelineProvider>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-background">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DataTable
            className="min-h-full rounded-none border-0 overflow-visible"
            rowClick="show"
            rowDoubleClick={canManageHours ? "edit" : "show"}
            rowClassName={getTimeEntryRowClassName}
            bulkActionButtons={
              <>
                <BulkApproveButton />
                {canManageHours ? <BulkDeleteButton /> : null}
              </>
            }
          >
            <DataTable.Col source="date" label="Date">
              <DateWithWeekdayField />
            </DataTable.Col>
            <DataTable.Col source="day_type" label="Day type">
              <DayTypeField />
            </DataTable.Col>
            <DataTable.Col label="Address">
              <AddressField />
            </DataTable.Col>
            <DataTable.Col label="Hora entrada">
              <StartTimeField />
            </DataTable.Col>
            <DataTable.Col label="Lunch">
              <LunchField />
            </DataTable.Col>
            <DataTable.Col label="Hora salida">
              <EndTimeField />
            </DataTable.Col>
            <DataTable.Col label="Total day">
              <DayTotalField />
            </DataTable.Col>
            <DataTable.Col label="Total pay">
              <TotalPayField />
            </DataTable.Col>
            <DataTable.Col label="Payroll flow">
              <PayrollFlowField />
            </DataTable.Col>
            {showEmployeeColumn ? (
              <DataTable.Col label="Employee">
                <ReferenceField
                  source="person_id"
                  reference="people"
                  link={false}
                >
                  <EmployeeNameField />
                </ReferenceField>
              </DataTable.Col>
            ) : null}
          </DataTable>
        </div>
        <div className="shrink-0 border-t bg-background px-2 py-2">
          <ListPagination rowsPerPageOptions={[10, 15, 20]} />
        </div>
      </div>
    </TimeEntryPipelineProvider>
  );
};

const EmployeesQuickNavigation = () => {
  const [query, setQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [minimized, setMinimized] = useStore<boolean>(
    "app.preferences.timeEntriesEmployeesExplorerMinimized",
    false,
  );
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const activeEmployeeId = filterValues.person_id
    ? Number(filterValues.person_id)
    : null;

  const { data: employees = [], isPending } = useGetList<Person>(
    "people",
    {
      pagination: { page: 1, perPage: 2000 },
      sort: { field: "first_name", order: "ASC" },
      filter: { type: "employee", status: "active" },
    },
    { staleTime: 30_000 },
  );

  const filteredEmployees = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) => {
      const name = employeeOptionText(employee).toLowerCase();
      const email = String(employee.email ?? "").toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [employees, query]);

  const selectEmployee = (personId?: number) => {
    const nextFilterValues = { ...filterValues };
    if (!personId) {
      delete nextFilterValues.person_id;
    } else {
      nextFilterValues.person_id = personId;
    }
    setFilters(nextFilterValues, displayedFilters);
    // Flat `person_id` in the URL (e.g. from Payroll) must not stick around or it
    // can win over sidebar picks on the next sync with location.
    if (searchParams.has("person_id") || searchParams.has("payroll_run_id")) {
      const params = new URLSearchParams(searchParams);
      params.delete("person_id");
      params.delete("payroll_run_id");
      setSearchParams(params, { replace: true });
    }
  };

  if (minimized) {
    return (
      <aside className="flex h-auto min-h-0 w-12 shrink-0 flex-col items-center self-start py-2 md:h-full md:py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMinimized(false)}
          aria-label="Expand employees panel"
          title="Expand employees panel"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        <span className="mt-4 text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          Employees
        </span>
      </aside>
    );
  }

  return (
    <aside className="flex h-auto max-h-[min(280px,40vh)] min-h-0 w-full shrink-0 flex-col rounded-lg border border-border/80 bg-muted/30 md:h-full md:max-h-none md:w-[20rem] md:max-w-[min(20rem,36vw)] md:rounded-none md:border-0 md:bg-transparent lg:w-[20rem]">
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
            placeholder={`Search employees (${employees.length})`}
            className="h-9 pl-8"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <button
          type="button"
          className={cn(
            "mb-1.5 w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60",
            activeEmployeeId == null && "border-primary/40 bg-secondary/60",
          )}
          onClick={() => selectEmployee(undefined)}
        >
          All employees
        </button>
        {isPending ? (
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
              return (
                <button
                  key={employee.id}
                  type="button"
                  className={cn(
                    "w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                    isActive && "border-primary/40 bg-secondary/60",
                  )}
                  onClick={() => selectEmployee(Number(employee.id))}
                >
                  <div className="font-medium">
                    {employeeOptionText(employee)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {employee.email || "No email"}
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

export const TimeEntriesList = () => (
  <List
    title={false}
    disableBreadcrumb
    sort={{ field: "date", order: "DESC" }}
    perPage={20}
    actions={<TimeEntriesListActions />}
    pagination={false}
    contentScrollable={false}
    filterDefaultValues={{}}
  >
    <TimeEntriesQuerySync />
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 overflow-hidden md:h-full md:flex-row">
      <EmployeesQuickNavigation />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <TimeEntriesTable />
      </div>
    </div>
  </List>
);
