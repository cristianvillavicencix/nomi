import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useMatch, useNavigate } from "react-router";
import {
  ShowBase,
  useCreate,
  useCreatePath,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
  useShowContext,
  useUpdate,
} from "ra-core";
import { ChevronLeft, Edit, ExternalLink, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { StickyTabsBar } from "@/components/atomic-crm/layout/page-shell";
import { canUseCrmPermission } from "@/components/atomic-crm/providers/commons/crmPermissions";
import { getCompanyPaySchedule } from "@/payroll/rules";
import type {
  Deal,
  EmployeeLoan,
  EmployeePtoAdjustment,
  Payment,
  PaymentLine,
  Person,
  TimeEntry,
} from "@/components/atomic-crm/types";
import { getLoanRecordTypeLabel, getLoanStatus, getRepaymentSummary } from "@/loans/helpers";
import { formatRate, getPersonDisplayName } from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;
const KNOWN_SPECIALTIES = new Set([
  "roofing",
  "siding",
  "gutters",
  "painting",
  "mitigation",
  "reconstruction",
  "plumbing",
  "electrical",
  "other",
]);

type TabValue =
  | "overview"
  | "time_entries"
  | "payroll"
  | "pto"
  | "loans"
  | "projects"
  | "costs"
  | "activity";

type AdjustmentFormState = {
  adjustment_date: string;
  adjustment_type: "sick" | "vacation";
  days_delta: string;
  reason: string;
  notes: string;
};

type SubcontractCostFilter = "all" | "Pending" | "Approved" | "Paid";

const EMPTY_ADJUSTMENT_FORM: AdjustmentFormState = {
  adjustment_date: new Date().toISOString().slice(0, 10),
  adjustment_type: "vacation",
  days_delta: "0",
  reason: "",
  notes: "",
};

const toDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value?: string | null) => {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-US");
};

const money = (value?: number | null) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const number = (value?: number | null) => Number(value ?? 0);

const maskSensitive = (value?: string | null, last = 4) => {
  const normalized = String(value ?? "").replace(/\s+/g, "");
  if (!normalized) return "—";
  if (normalized.length <= last) return normalized;
  return `${"*".repeat(Math.max(0, normalized.length - last))}${normalized.slice(-last)}`;
};

const getInitials = (person: Person) => {
  const first = (person.first_name ?? "").trim().charAt(0);
  const last = (person.last_name ?? "").trim().charAt(0);
  const initials = `${first}${last}`.toUpperCase();
  return initials || "EM";
};

const getWeekRange = (today: Date) => {
  const start = new Date(today);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const getQuarterStart = (date: Date) =>
  new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
const getYearStart = (date: Date) => new Date(date.getFullYear(), 0, 1);

const getWeekdayIndex = (value?: string | null) => {
  if (!value) return 5;
  const map: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  const key = value.trim().toLowerCase();
  return map[key] ?? 5;
};

const getCurrentPayPeriodRange = (
  settings: ReturnType<typeof useConfigurationContext>["payrollSettings"],
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const paySchedule = getCompanyPaySchedule(settings);

  if (paySchedule === "weekly") {
    const paydayWeekday = getWeekdayIndex(
      settings?.weeklyPayday ?? settings?.payday ?? "Friday",
    );
    const end = new Date(today);
    const daysSincePayday = (end.getDay() - paydayWeekday + 7) % 7;
    end.setDate(end.getDate() - daysSincePayday);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (paySchedule === "monthly") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { start, end };
  }

  if (paySchedule === "semimonthly") {
    const startDay = Math.max(1, Number(settings?.payPeriodStartDay ?? 1));
    const endDay = Math.max(startDay, Number(settings?.payPeriodEndDay ?? 15));
    const currentDay = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();

    if (currentDay <= endDay) {
      return {
        start: new Date(year, month, Math.min(startDay, lastDay), 0, 0, 0, 0),
        end: new Date(year, month, Math.min(endDay, lastDay), 23, 59, 59, 999),
      };
    }

    return {
      start: new Date(year, month, Math.min(endDay + 1, lastDay), 0, 0, 0, 0),
      end: new Date(year, month, lastDay, 23, 59, 59, 999),
    };
  }

  const anchor =
    toDate(settings?.biweeklyAnchorDate ?? null) ?? new Date(today.getFullYear(), 0, 2);
  anchor.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - anchor.getTime()) / DAY_MS);
  const periodIndex = Math.floor(diffDays / 14);
  const start = new Date(anchor);
  start.setDate(start.getDate() + periodIndex * 14);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const inRange = (value?: string | null, start?: Date | null, end?: Date | null) => {
  const date = toDate(value);
  if (!date || !start || !end) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
};

const isPaidLeaveDay = (dayType?: string | null) =>
  dayType === "holiday" ||
  dayType === "day_off" ||
  dayType === "sick_day" ||
  dayType === "vacation_day";

const getCompensationLabel = (person: Person) => {
  if (person.compensation_unit === "hour") return "Per Hour";
  if (person.compensation_unit === "day") return "Per Day";
  if (person.compensation_unit === "week") return "Per Week";
  if (person.compensation_unit === "month") return "Per Month";
  if (person.compensation_unit === "year") return "Salary (annual)";
  if (person.compensation_mode === "hourly") return "Hourly";
  if (person.compensation_mode === "salary") return "Salary";
  if (person.compensation_mode === "day_rate") return "Daily";
  if (person.pay_type === "hourly") return "Hourly";
  if (person.pay_type === "salary") return "Salary";
  if (person.pay_type === "day_rate") return "Daily";
  return "—";
};

const includesId = (values: unknown, personId: string) =>
  Array.isArray(values) && values.some((item) => String(item) === personId);

export const PeopleProfileDetailsContent = ({
  showBackButton = true,
}: {
  showBackButton?: boolean;
}) => {
  const { record, isPending } = useShowContext<Person>();
  const createPath = useCreatePath();
  const location = useLocation();
  const navigate = useNavigate();
  const tabMatch = useMatch("/people/:id/show/:tab");
  const quickTabMatch = useMatch("/people/:group/:id/:tab");
  const quickBaseMatch = useMatch("/people/:group/:id");
  const config = useConfigurationContext();
  const refresh = useRefresh();
  const notify = useNotify();
  const { data: identity } = useGetIdentity();
  const [create] = useCreate();
  const [update] = useUpdate();

  const [isPtoAdjustmentOpen, setIsPtoAdjustmentOpen] = useState(false);
  const [subcontractProjectFilter, setSubcontractProjectFilter] =
    useState<SubcontractCostFilter>("all");
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentFormState>(
    EMPTY_ADJUSTMENT_FORM,
  );
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  const personId = record?.id;
  const personType = record?.type;
  const personIdString = String(personId ?? "");
  const currentYearStart = `${new Date().getFullYear()}-01-01`;
  const canManagePeople = canUseCrmPermission(identity as any, "people.manage");

  const { data: timeEntries = [] } = useGetList<TimeEntry>(
    "time_entries",
    {
      pagination: { page: 1, perPage: 10000 },
      sort: { field: "date", order: "DESC" },
      filter: {
        person_id: personId,
        "date@gte": currentYearStart,
      },
    },
    { enabled: Boolean(personId) },
  );

  const { data: payrollLines = [] } = useGetList<any>(
    "payroll_run_lines",
    {
      pagination: { page: 1, perPage: 10000 },
      sort: { field: "id", order: "DESC" },
      filter: { employee_id: personId },
    },
    { enabled: Boolean(personId) },
  );

  const { data: payrollRuns = [] } = useGetList<any>(
    "payroll_runs",
    {
      pagination: { page: 1, perPage: 5000 },
      sort: { field: "id", order: "DESC" },
      filter: {},
    },
    { enabled: Boolean(personId) },
  );

  const { data: projects = [] } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 5000 },
      sort: { field: "updated_at", order: "DESC" },
      filter: {},
    },
    { enabled: Boolean(personId) },
  );

  const { data: ptoAdjustments = [] } = useGetList<EmployeePtoAdjustment>(
    "employee_pto_adjustments",
    {
      pagination: { page: 1, perPage: 5000 },
      sort: { field: "adjustment_date", order: "DESC" },
      filter: { employee_id: personId },
    },
    { enabled: Boolean(personId) },
  );

  const { data: employeeLoans = [] } = useGetList<EmployeeLoan>(
    "employee_loans",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "loan_date", order: "DESC" },
      filter: { employee_id: personId },
    },
    { enabled: Boolean(personId) },
  );

  const { data: paymentLines = [] } = useGetList<PaymentLine>(
    "payment_lines",
    {
      pagination: { page: 1, perPage: 10000 },
      sort: { field: "created_at", order: "DESC" },
      filter: { person_id: personId },
    },
    { enabled: Boolean(personId) },
  );

  const { data: payments = [] } = useGetList<Payment>(
    "payments",
    {
      pagination: { page: 1, perPage: 5000 },
      sort: { field: "pay_date", order: "DESC" },
      filter: {},
    },
    { enabled: Boolean(personId) },
  );

  const summary = useMemo(() => {
    if (!record) return null;
    const weekRange = getWeekRange(new Date());
    const payPeriodRange = getCurrentPayPeriodRange(config.payrollSettings);

    const hoursThisWeek = Number(
      timeEntries
        .filter((entry) => inRange(entry.date, weekRange.start, weekRange.end))
        .reduce((sum, entry) => sum + number(entry.payable_hours ?? entry.hours), 0)
        .toFixed(2),
    );

    const timeEntriesPayPeriod = timeEntries.filter((entry) =>
      inRange(entry.date, payPeriodRange.start, payPeriodRange.end),
    );

    const hoursThisPayPeriod = Number(
      timeEntriesPayPeriod
        .reduce((sum, entry) => sum + number(entry.payable_hours ?? entry.hours), 0)
        .toFixed(2),
    );

    const overtimeHoursThisPayPeriod = Number(
      timeEntriesPayPeriod
        .reduce((sum, entry) => sum + number(entry.overtime_hours), 0)
        .toFixed(2),
    );

    const ptoEntries = timeEntries.filter(
      (entry) => entry.day_type === "sick_day" || entry.day_type === "vacation_day",
    );

    const sickUsedHours = ptoEntries
      .filter((entry) => entry.day_type === "sick_day")
      .reduce((sum, entry) => sum + number(entry.payable_hours ?? entry.hours), 0);
    const vacationUsedHours = ptoEntries
      .filter((entry) => entry.day_type === "vacation_day")
      .reduce((sum, entry) => sum + number(entry.payable_hours ?? entry.hours), 0);

    const sickUsedDays = Number((sickUsedHours / 8).toFixed(2));
    const vacationUsedDays = Number((vacationUsedHours / 8).toFixed(2));
    const lastPtoActivity = [...ptoEntries].sort((a, b) => b.date.localeCompare(a.date))[0];

    const payrollRunById = new Map(payrollRuns.map((run) => [String(run.id), run]));
    const latestPayrollLine = payrollLines[0];
    const latestPayrollRun = latestPayrollLine
      ? payrollRunById.get(String(latestPayrollLine.payroll_run_id))
      : null;

    const ytdGross = Number(
      payrollLines.reduce((sum, line) => sum + number(line.gross_pay), 0).toFixed(2),
    );

    const ytdOvertime = Number(
      timeEntries.reduce((sum, entry) => sum + number(entry.overtime_hours), 0).toFixed(2),
    );

    const assignedProjects = projects
      .filter((project) => {
        if (personType === "salesperson") {
          return includesId(project.salesperson_ids, personIdString);
        }
        if (personType === "subcontractor") {
          return includesId(project.subcontractor_ids, personIdString);
        }
        return includesId(project.worker_ids, personIdString);
      })
      .map((project) => {
        const projectHours = timeEntries
          .filter((entry) => String(entry.project_id ?? "") === String(project.id))
          .reduce((sum, entry) => sum + number(entry.payable_hours ?? entry.hours), 0);
        return {
          ...project,
          projectHours: Number(projectHours.toFixed(2)),
          role:
            personType === "salesperson"
              ? "Salesperson"
              : personType === "subcontractor"
                ? "Subcontractor"
                : "Employee",
        };
      });

    const activeProjects = assignedProjects.filter(
      (project) => project.stage !== "completed" && project.stage !== "closed",
    ).length;

    const daysWorkedThisPayPeriod = timeEntriesPayPeriod.filter(
      (entry) =>
        (entry.day_type ?? "worked_day") === "worked_day" &&
        number(entry.payable_hours ?? entry.hours) > 0,
    ).length;

    const activity = [
      ...(record.created_at
        ? [
            {
              date: record.created_at,
              label: "Employee created",
              detail: "Profile was created in People.",
            },
          ]
        : []),
      ...payrollLines.slice(0, 8).map((line) => ({
        date: payrollRunById.get(String(line.payroll_run_id))?.payday ?? line.created_at ?? null,
        label: "Payroll processed",
        detail: `Gross ${money(line.gross_pay)} • Net ${money(line.net_pay)}`,
      })),
      ...ptoAdjustments.slice(0, 8).map((adj) => ({
        date: adj.adjustment_date,
        label: "PTO adjustment",
        detail: `${adj.adjustment_type} ${Number(adj.days_delta) > 0 ? "+" : ""}${Number(adj.days_delta).toFixed(2)} days${adj.reason ? ` • ${adj.reason}` : ""}`,
      })),
      ...timeEntries.slice(0, 8).map((entry) => ({
        date: entry.date,
        label: "Time entry logged",
        detail: `${number(entry.payable_hours ?? entry.hours).toFixed(2)}h • ${entry.day_type ?? "worked_day"}`,
      })),
      ...assignedProjects.slice(0, 8).map((project) => ({
        date: project.updated_at ?? project.created_at ?? null,
        label: "Assigned to project",
        detail: `${project.name} • ${project.stage}`,
      })),
    ]
      .filter((item) => !!item.date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 30);

    return {
      hoursThisWeek,
      hoursThisPayPeriod,
      overtimeHoursThisPayPeriod,
      ytdGross,
      ytdOvertime,
      sickUsedDays,
      vacationUsedDays,
      lastPtoActivity,
      latestPayrollLine,
      latestPayrollRun,
      assignedProjects,
      activeProjects,
      daysWorkedThisPayPeriod,
      ptoAdjustments,
      payPeriodRange,
      activity,
    };
  }, [
    config.payrollSettings,
    payrollLines,
    payrollRuns,
    personIdString,
    personType,
    projects,
    ptoAdjustments,
    record,
    timeEntries,
  ]);

  const subcontractorSummary = useMemo(() => {
    if (!record || record.type !== "subcontractor") return null;

    const paymentById = new Map(payments.map((payment) => [String(payment.id), payment]));
    const now = new Date();
    const monthStart = getMonthStart(now);
    const quarterStart = getQuarterStart(now);
    const yearStart = getYearStart(now);

    const assignedProjects = projects
      .filter((project) => includesId(project.subcontractor_ids, personIdString))
      .map((project) => ({
        ...project,
        projectHours: Number(
          timeEntries
            .filter((entry) => String(entry.project_id ?? "") === String(project.id))
            .reduce((sum, entry) => sum + number(entry.payable_hours ?? entry.hours), 0)
            .toFixed(2),
        ),
      }));

    const activeProjectsCount = assignedProjects.filter(
      (project) => project.stage !== "completed" && project.stage !== "closed",
    ).length;

    const costRows = paymentLines
      .map((line) => {
        const payment = line.payment_id ? paymentById.get(String(line.payment_id)) : undefined;
        const eventDate = toDate(payment?.pay_date ?? line.created_at ?? null);
        if (!eventDate) return null;
        const amount = number(line.amount ?? line.total_pay);
        if (amount === 0) return null;
        const paymentStatus = payment?.status ?? "draft";
        return {
          id: line.id,
          project_id: line.project_id ?? null,
          payment_id: line.payment_id ?? null,
          date: eventDate,
          dateIso: eventDate.toISOString().slice(0, 10),
          amount,
          source_type: line.source_type ?? "adjustment",
          compensation_type: line.compensation_type ?? null,
          payment_status: paymentStatus,
          statusLabel:
            paymentStatus === "paid"
              ? "Paid"
              : paymentStatus === "approved"
                ? "Approved"
                : "Pending",
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const totalCostThisMonth = Number(
      costRows
        .filter((row) => row.date.getTime() >= monthStart.getTime())
        .reduce((sum, row) => sum + row.amount, 0)
        .toFixed(2),
    );
    const totalCostThisQuarter = Number(
      costRows
        .filter((row) => row.date.getTime() >= quarterStart.getTime())
        .reduce((sum, row) => sum + row.amount, 0)
        .toFixed(2),
    );
    const totalCostYtd = Number(
      costRows
        .filter((row) => row.date.getTime() >= yearStart.getTime())
        .reduce((sum, row) => sum + row.amount, 0)
        .toFixed(2),
    );
    const pendingCostItems = costRows.filter((row) => row.payment_status === "draft").length;
    const paidAmountYtd = Number(
      costRows
        .filter((row) => row.payment_status === "paid" && row.date.getTime() >= yearStart.getTime())
        .reduce((sum, row) => sum + row.amount, 0)
        .toFixed(2),
    );

    const lastProjectCostRecorded = costRows.find((row) => row.project_id != null) ?? null;

    const byProject = new Map<
      string,
      {
        total: number;
        costType: string;
        status: string;
        lastDate: string;
      }
    >();

    for (const row of costRows) {
      if (!row.project_id) continue;
      const key = String(row.project_id);
      const prev = byProject.get(key);
      if (!prev) {
        byProject.set(key, {
          total: row.amount,
          costType: row.compensation_type ?? row.source_type,
          status: row.statusLabel,
          lastDate: row.dateIso,
        });
      } else {
        byProject.set(key, {
          total: Number((prev.total + row.amount).toFixed(2)),
          costType: prev.costType,
          status: row.statusLabel,
          lastDate: prev.lastDate > row.dateIso ? prev.lastDate : row.dateIso,
        });
      }
    }

    const projectRows = assignedProjects.map((project) => {
      const costData = byProject.get(String(project.id));
      return {
        ...project,
        costType: costData?.costType ?? "—",
        costValue: costData?.total ?? 0,
        costStatus: costData?.status ?? "Pending",
        lastCostDate: costData?.lastDate ?? null,
      };
    });

    const lastAssignedProject = [...assignedProjects].sort((a, b) =>
      String(b.updated_at ?? b.created_at ?? "").localeCompare(
        String(a.updated_at ?? a.created_at ?? ""),
      ),
    )[0];

    const activity = [
      ...(record.created_at
        ? [
            {
              date: record.created_at,
              label: "Subcontractor created",
              detail: "Profile created in People.",
            },
          ]
        : []),
      ...costRows.slice(0, 10).map((row) => ({
        date: row.dateIso,
        label: "Cost recorded",
        detail: `${money(row.amount)} • ${row.statusLabel}${row.project_id ? ` • Project #${row.project_id}` : ""}`,
      })),
      ...projectRows.slice(0, 10).map((project) => ({
        date: project.updated_at ?? project.created_at ?? null,
        label: "Assigned to project",
        detail: `${project.name} • ${project.stage}`,
      })),
      ...(record.specialty
        ? [
            {
              date: record.created_at ?? new Date().toISOString(),
              label: "Specialty registered",
              detail: record.specialty,
            },
          ]
        : []),
    ]
      .filter((item) => !!item.date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 30);

    return {
      assignedProjects,
      activeProjectsCount,
      projectRows,
      costRows,
      totalCostThisMonth,
      totalCostThisQuarter,
      totalCostYtd,
      pendingCostItems,
      paidAmountYtd,
      lastProjectCostRecorded,
      lastAssignedProject,
      lastActivity: activity[0] ?? null,
      activity,
      isCustomSpecialty:
        Boolean(record.specialty) &&
        !KNOWN_SPECIALTIES.has(String(record.specialty).trim().toLowerCase()),
    };
  }, [paymentLines, payments, personIdString, projects, record, timeEntries]);

  const currentTab = useMemo<TabValue>(() => {
    const tab = (quickTabMatch?.params?.tab ??
      tabMatch?.params?.tab) as TabValue | undefined;
    if (
      tab === "overview" ||
      tab === "time_entries" ||
      tab === "payroll" ||
      tab === "pto" ||
      tab === "loans" ||
      tab === "projects" ||
      tab === "costs" ||
      tab === "activity"
    ) {
      return tab;
    }
    return "overview";
  }, [quickTabMatch?.params?.tab, tabMatch?.params?.tab]);

  const handleTabChange = (nextTab: string) => {
    if (!record) return;
    if (nextTab === currentTab) return;
    const quickGroup = quickBaseMatch?.params?.group ?? quickTabMatch?.params?.group;
    const quickId = quickBaseMatch?.params?.id ?? quickTabMatch?.params?.id;
    if (quickGroup && quickId) {
      if (nextTab === "overview") {
        navigate(`/people/${quickGroup}/${quickId}`);
        return;
      }
      navigate(`/people/${quickGroup}/${quickId}/${nextTab}`);
      return;
    }
    if (nextTab === "overview") {
      navigate(`/people/${record.id}/show`);
      return;
    }
    navigate(`/people/${record.id}/show/${nextTab}`);
  };

  const submitPtoAdjustment = async () => {
    if (!record) return;
    if (!canManagePeople) {
      notify("You do not have permission to create PTO adjustments", { type: "error" });
      return;
    }
    const parsedDelta = Number(adjustmentForm.days_delta);
    if (!Number.isFinite(parsedDelta) || parsedDelta === 0) {
      notify("Days delta must be a non-zero number", { type: "warning" });
      return;
    }
    if (!adjustmentForm.adjustment_date) {
      notify("Adjustment date is required", { type: "warning" });
      return;
    }

    setIsSubmittingAdjustment(true);

    create(
      "employee_pto_adjustments",
      {
        data: {
          employee_id: record.id,
          adjustment_date: adjustmentForm.adjustment_date,
          adjustment_type: adjustmentForm.adjustment_type,
          days_delta: parsedDelta,
          reason: adjustmentForm.reason || null,
          notes: adjustmentForm.notes || null,
          created_by: "Current User",
        },
        meta: { identity },
      },
      {
        onSuccess: () => {
          const fieldName =
            adjustmentForm.adjustment_type === "sick"
              ? "sick_balance_days"
              : "vacation_balance_days";
          const currentBalance = number(
            adjustmentForm.adjustment_type === "sick"
              ? record.sick_balance_days
              : record.vacation_balance_days,
          );

          update(
            "people",
            {
              id: record.id,
              data: {
                [fieldName]: Number((currentBalance + parsedDelta).toFixed(2)),
              },
              previousData: record,
              meta: { identity },
            },
            {
              onSuccess: () => {
                notify("PTO adjustment saved", { type: "success" });
                setIsPtoAdjustmentOpen(false);
                setAdjustmentForm(EMPTY_ADJUSTMENT_FORM);
                refresh();
              },
              onError: () => {
                notify("PTO adjustment saved, but balance update failed", {
                  type: "warning",
                });
                refresh();
              },
              onSettled: () => {
                setIsSubmittingAdjustment(false);
              },
            },
          );
        },
        onError: () => {
          notify("Could not save PTO adjustment", { type: "error" });
          setIsSubmittingAdjustment(false);
        },
      },
    );
  };

  if (isPending || !record || !summary) return null;

  const displayName = getPersonDisplayName(record) || record.business_name || "Employee";
  const isQuickDetailLayout = !showBackButton;
  const isEmployee = record.type === "employee";
  const isSalesperson = record.type === "salesperson";
  const canSeeTimeEntriesAndPayroll =
    isEmployee || (isSalesperson && record.pay_type !== "commission");
  const allowedTabs: TabValue[] = isEmployee
    ? ["overview", "time_entries", "payroll", "pto", "loans", "projects", "activity"]
    : canSeeTimeEntriesAndPayroll
      ? ["overview", "time_entries", "payroll", "projects", "activity"]
      : ["overview", "projects", "activity"];

  useEffect(() => {
    if (!allowedTabs.includes(currentTab)) {
      handleTabChange("overview");
    }
  }, [allowedTabs, currentTab]);

  if (record.type === "subcontractor" && subcontractorSummary) {
    const filteredProjectRows =
      subcontractProjectFilter === "all"
        ? subcontractorSummary.projectRows
        : subcontractorSummary.projectRows.filter(
            (project) => project.costStatus === subcontractProjectFilter,
          );

    return (
      <div
        className={
          isQuickDetailLayout
            ? "flex h-full min-h-0 flex-col overflow-hidden"
            : "space-y-6 pb-8"
        }
      >
        <div className={isQuickDetailLayout ? "sticky top-0 z-30 bg-background pb-3" : ""}>
          <Card>
          <CardContent className="pt-6">
            {showBackButton ? (
              <Button
                type="button"
                variant="ghost"
                className="mb-3 gap-2 px-0"
                onClick={() => navigate(location.state?.from ?? "/people")}
              >
                <ChevronLeft className="size-4" />
                Regresar
              </Button>
            ) : null}

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="size-16">
                  <AvatarFallback>{getInitials(record)}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold">
                      {record.business_name || getPersonDisplayName(record) || "Subcontractor"}
                    </h1>
                    <Badge variant={record.status === "active" ? "outline" : "secondary"}>
                      {record.status}
                    </Badge>
                    <Badge variant="secondary">Subcontractor</Badge>
                    {record.specialty ? (
                      <Badge variant="secondary">{record.specialty}</Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3.5" />
                      {record.email || "No email"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3.5" />
                      {record.phone || "No phone"}
                    </span>
                  </div>
                </div>
              </div>

              {canManagePeople ? (
                <Button asChild variant="outline">
                  <Link
                    to={createPath({
                      resource: "people",
                      id: record.id,
                      type: "edit",
                    })}
                    state={{ from: location.pathname }}
                  >
                    <Edit className="mr-1 size-4" />
                    Edit Profile
                  </Link>
                </Button>
              ) : null}
            </div>

          </CardContent>
          </Card>
        </div>

        <Tabs
          value={currentTab}
          onValueChange={handleTabChange}
          className={isQuickDetailLayout ? "flex min-h-0 flex-1 flex-col gap-3" : "gap-4"}
        >
          {isQuickDetailLayout ? (
            <StickyTabsBar>
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="projects">Projects</TabsTrigger>
                <TabsTrigger value="costs">Costs</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
            </StickyTabsBar>
          ) : (
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="costs">Costs</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
          )}

          <TabsContent
            value="overview"
            className={
              isQuickDetailLayout ? "mt-0 min-h-0 flex-1 overflow-y-auto space-y-4 pr-1" : "space-y-4"
            }
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Business / Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Business name</p>
                    <p className="font-medium">{record.business_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">First name</p>
                    <p className="font-medium">{record.first_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last name</p>
                    <p className="font-medium">{record.last_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{record.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{record.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">{record.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium">{formatDate(record.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Updated</p>
                    <p className="font-medium">{formatDate((record as { updated_at?: string }).updated_at)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Specialty Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Trade / Specialty:</span>{" "}
                    <span className="font-medium">{record.specialty || "No specialty configured"}</span>
                  </p>
                  {subcontractorSummary.isCustomSpecialty ? (
                    <Badge variant="secondary">Custom specialty</Badge>
                  ) : record.specialty ? (
                    <Badge variant="outline">Standard specialty</Badge>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cost Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <p>This month: <span className="font-semibold">{money(subcontractorSummary.totalCostThisMonth)}</span></p>
                    <p>This quarter: <span className="font-semibold">{money(subcontractorSummary.totalCostThisQuarter)}</span></p>
                    <p>YTD total: <span className="font-semibold">{money(subcontractorSummary.totalCostYtd)}</span></p>
                    <p>Paid YTD: <span className="font-semibold">{money(subcontractorSummary.paidAmountYtd)}</span></p>
                    <p>Pending items: <span className="font-semibold">{subcontractorSummary.pendingCostItems}</span></p>
                    <p>
                      Last project cost:{" "}
                      <span className="font-semibold">
                        {subcontractorSummary.lastProjectCostRecorded
                          ? `${money(subcontractorSummary.lastProjectCostRecorded.amount)} on ${formatDate(subcontractorSummary.lastProjectCostRecorded.dateIso)}`
                          : "—"}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/people/${record.id}/show/costs`}>View cost history</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/people/${record.id}/show/projects`}>View cost by project</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {record.notes ? (
                    <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No notes yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent
            value="projects"
            className={isQuickDetailLayout ? "mt-0 min-h-0 flex-1 overflow-y-auto pr-1" : ""}
          >
            <Card>
              <CardHeader>
                <CardTitle>Assigned Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={subcontractProjectFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSubcontractProjectFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant={subcontractProjectFilter === "Pending" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSubcontractProjectFilter("Pending")}
                  >
                    Pending
                  </Button>
                  <Button
                    type="button"
                    variant={subcontractProjectFilter === "Approved" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSubcontractProjectFilter("Approved")}
                  >
                    Approved
                  </Button>
                  <Button
                    type="button"
                    variant={subcontractProjectFilter === "Paid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSubcontractProjectFilter("Paid")}
                  >
                    Paid
                  </Button>
                </div>

                {filteredProjectRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assigned projects.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project name</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Estimated value</TableHead>
                        <TableHead>Cost type</TableHead>
                        <TableHead>Cost value</TableHead>
                        <TableHead>Cost status</TableHead>
                        <TableHead className="text-right">Link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjectRows.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell>{project.name}</TableCell>
                          <TableCell>{project.stage}</TableCell>
                          <TableCell>{project.category}</TableCell>
                          <TableCell>{money(project.estimated_value ?? project.amount)}</TableCell>
                          <TableCell>{project.costType}</TableCell>
                          <TableCell>{money(project.costValue)}</TableCell>
                          <TableCell>{project.costStatus}</TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="sm">
                              <Link to={`/deals/${project.id}/show`}>
                                <ExternalLink className="size-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="costs"
            className={isQuickDetailLayout ? "mt-0 min-h-0 flex-1 overflow-y-auto pr-1" : ""}
          >
            <Card>
              <CardHeader>
                <CardTitle>Cost History</CardTitle>
              </CardHeader>
              <CardContent>
                {subcontractorSummary.costRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cost records found.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Cost type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subcontractorSummary.costRows.slice(0, 60).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{formatDate(row.dateIso)}</TableCell>
                          <TableCell>
                            {row.project_id
                              ? subcontractorSummary.projectRows.find(
                                  (project) => String(project.id) === String(row.project_id),
                                )?.name ?? `Project #${row.project_id}`
                              : "—"}
                          </TableCell>
                          <TableCell>{row.compensation_type ?? row.source_type}</TableCell>
                          <TableCell>{money(row.amount)}</TableCell>
                          <TableCell>{row.statusLabel}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="activity"
            className={isQuickDetailLayout ? "mt-0 min-h-0 flex-1 overflow-y-auto pr-1" : ""}
          >
            <Card>
              <CardHeader>
                <CardTitle>Activity / History</CardTitle>
              </CardHeader>
              <CardContent>
                {subcontractorSummary.activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity found.</p>
                ) : (
                  <div className="space-y-3">
                    {subcontractorSummary.activity.map((event, index) => (
                      <div key={`${event.label}-${event.date}-${index}`} className="rounded-md border p-3">
                        <p className="text-sm font-medium">{event.label}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(String(event.date))}</p>
                        <p className="text-sm">{event.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div
      className={
        isQuickDetailLayout
          ? "flex h-full min-h-0 flex-col overflow-hidden"
          : "space-y-6 pb-8"
      }
    >
      <div className={isQuickDetailLayout ? "sticky top-0 z-30 bg-background pb-3" : ""}>
        <Card>
        <CardContent className="pt-6">
          {showBackButton ? (
            <Button
              type="button"
              variant="ghost"
              className="mb-3 gap-2 px-0"
              onClick={() => navigate(location.state?.from ?? "/people")}
            >
              <ChevronLeft className="size-4" />
              Regresar
            </Button>
          ) : null}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="size-16">
                <AvatarFallback>{getInitials(record)}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold">{displayName}</h1>
                  <Badge variant={record.status === "active" ? "outline" : "secondary"}>
                    {record.status}
                  </Badge>
                  <Badge variant="secondary">{record.type}</Badge>
                  <Badge variant="secondary">{getCompensationLabel(record)}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3.5" />
                    {record.email || "No email"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3.5" />
                    {record.phone || "No phone"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canManagePeople ? (
                <Button asChild variant="outline">
                  <Link
                    to={createPath({
                      resource: "people",
                      id: record.id,
                      type: "edit",
                    })}
                    state={{ from: location.pathname }}
                  >
                    <Edit className="mr-1 size-4" />
                    Edit Profile
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

        </CardContent>
        </Card>
      </div>

      <Tabs
        value={currentTab}
        onValueChange={handleTabChange}
        className={isQuickDetailLayout ? "flex min-h-0 flex-1 flex-col gap-3" : "gap-4"}
      >
        {isQuickDetailLayout ? (
          <StickyTabsBar>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {canSeeTimeEntriesAndPayroll ? (
                <TabsTrigger value="time_entries">Time Entries</TabsTrigger>
              ) : null}
              {canSeeTimeEntriesAndPayroll ? (
                <TabsTrigger value="payroll">Payroll</TabsTrigger>
              ) : null}
              {isEmployee ? <TabsTrigger value="pto">PTO</TabsTrigger> : null}
              {isEmployee ? <TabsTrigger value="loans">Loans</TabsTrigger> : null}
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
          </StickyTabsBar>
        ) : (
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {canSeeTimeEntriesAndPayroll ? (
              <TabsTrigger value="time_entries">Time Entries</TabsTrigger>
            ) : null}
            {canSeeTimeEntriesAndPayroll ? <TabsTrigger value="payroll">Payroll</TabsTrigger> : null}
            {isEmployee ? <TabsTrigger value="pto">PTO</TabsTrigger> : null}
            {isEmployee ? <TabsTrigger value="loans">Loans</TabsTrigger> : null}
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        )}

        <TabsContent
          value="overview"
          className={
            isQuickDetailLayout ? "mt-0 min-h-0 flex-1 overflow-y-auto space-y-4 pr-1" : "space-y-4"
          }
        >
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">First name</p>
                  <p className="font-medium">{record.first_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last name</p>
                  <p className="font-medium">{record.last_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{record.email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium">{record.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium">{record.status}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(record.created_at)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {isSalesperson ? "Sales Compensation & Contracts" : "Employment & Compensation"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Compensation type:</span>{" "}
                  <span className="font-medium">{getCompensationLabel(record)}</span>
                </p>
                {record.employment_start_date ? (
                  <p>
                    <span className="text-muted-foreground">Start date (work):</span>{" "}
                    <span className="font-medium">
                      {formatDate(record.employment_start_date as string)}
                    </span>
                  </p>
                ) : null}
                {record.compensation_unit === "hour" || record.compensation_mode === "hourly" ? (
                  <p>
                    <span className="text-muted-foreground">Hourly rate:</span>{" "}
                    <span className="font-medium">{money(record.compensation_amount ?? record.hourly_rate)}</span>
                  </p>
                ) : null}
                {record.compensation_unit === "week" ? (
                  <p>
                    <span className="text-muted-foreground">Weekly amount:</span>{" "}
                    <span className="font-medium">{money(record.compensation_amount ?? record.weekly_salary_amount)}</span>
                  </p>
                ) : null}
                {record.compensation_unit === "year" ? (
                  <>
                    <p>
                      <span className="text-muted-foreground">Annual salary:</span>{" "}
                      <span className="font-medium">
                        {money(record.annual_salary ?? record.compensation_amount)}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Monthly equivalent (approx.):</span>{" "}
                      <span className="font-medium">
                        {money(record.monthly_salary_amount ?? record.salary_rate)}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Company pay schedule:</span>{" "}
                      <span className="font-medium">
                        Payment Settings ({getCompanyPaySchedule(config.payrollSettings)})
                      </span>
                    </p>
                  </>
                ) : null}
                {record.compensation_unit === "month" ||
                (record.compensation_mode === "salary" && record.compensation_unit !== "year") ? (
                  <>
                    <p>
                      <span className="text-muted-foreground">Monthly amount:</span>{" "}
                      <span className="font-medium">{money(record.compensation_amount ?? record.monthly_salary_amount ?? record.salary_amount)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Company pay schedule:</span>{" "}
                      <span className="font-medium">
                        Payment Settings ({getCompanyPaySchedule(config.payrollSettings)})
                      </span>
                    </p>
                  </>
                ) : null}
                {record.compensation_unit === "day" || record.compensation_mode === "day_rate" ? (
                  <p>
                    <span className="text-muted-foreground">Day rate:</span>{" "}
                    <span className="font-medium">{money(record.compensation_amount ?? record.day_rate)}</span>
                  </p>
                ) : null}
                <p>
                  <span className="text-muted-foreground">Payment method:</span>{" "}
                  <span className="font-medium">{record.payment_method ?? "—"}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Overtime policy source:</span>{" "}
                  <span className="font-medium">Payment Settings (global)</span>
                </p>
                {isSalesperson ? (
                  <p>
                    <span className="text-muted-foreground">Commission model:</span>{" "}
                    <span className="font-medium">
                      Per project assignment / contract (not global)
                    </span>
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {isEmployee ? (
              <Card>
              <CardHeader>
                <CardTitle>Payment Method Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {record.payment_method === "bank_deposit" ? (
                  <>
                    <p><span className="text-muted-foreground">Account holder:</span> <span className="font-medium">{record.bank_account_holder_name ?? "—"}</span></p>
                    <p><span className="text-muted-foreground">Bank name:</span> <span className="font-medium">{record.bank_name ?? "—"}</span></p>
                    <p><span className="text-muted-foreground">Routing number:</span> <span className="font-medium">{maskSensitive(record.routing_number, 3)}</span></p>
                    <p><span className="text-muted-foreground">Account number:</span> <span className="font-medium">{maskSensitive(record.account_number, 4)}</span></p>
                    <p><span className="text-muted-foreground">Account type:</span> <span className="font-medium">{record.account_type ?? "—"}</span></p>
                  </>
                ) : null}
                {record.payment_method === "zelle" ? (
                  <>
                    <p><span className="text-muted-foreground">Account holder:</span> <span className="font-medium">{record.zelle_account_holder_name ?? "—"}</span></p>
                    <p><span className="text-muted-foreground">Zelle contact:</span> <span className="font-medium">{record.zelle_contact ?? "—"}</span></p>
                  </>
                ) : null}
                {record.payment_method === "check" ? (
                  <p><span className="text-muted-foreground">Pay to name:</span> <span className="font-medium">{record.check_pay_to_name ?? "—"}</span></p>
                ) : null}
                {record.payment_method === "cash" ? <p className="font-medium">Cash payment</p> : null}
                {!record.payment_method ? <p className="font-medium">No payment method configured.</p> : null}
              </CardContent>
              </Card>
            ) : null}

            {isEmployee ? (
              <Card>
              <CardHeader>
                <CardTitle>PTO / Time Off Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <p>Holidays paid: <span className="font-medium">{record.holidays_paid ? "Yes" : "No"}</span></p>
                  <p>Off days paid: <span className="font-medium">{record.off_days_paid ? "Yes" : "No"}</span></p>
                  <p>Sick days paid: <span className="font-medium">{record.sick_days_paid ? "Yes" : "No"}</span></p>
                  <p>Vacation days paid: <span className="font-medium">{record.vacation_days_paid ? "Yes" : "No"}</span></p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <p>Sick balance: <span className="font-semibold">{number(record.sick_balance_days).toFixed(2)} days</span></p>
                  <p>Vacation balance: <span className="font-semibold">{number(record.vacation_balance_days).toFixed(2)} days</span></p>
                  <p>Sick used (YTD): <span className="font-semibold">{summary.sickUsedDays.toFixed(2)} days</span></p>
                  <p>Vacation used (YTD): <span className="font-semibold">{summary.vacationUsedDays.toFixed(2)} days</span></p>
                </div>
                <p>
                  Last PTO activity:{" "}
                  <span className="font-medium">
                    {summary.lastPtoActivity
                      ? `${summary.lastPtoActivity.day_type} on ${formatDate(summary.lastPtoActivity.date)}`
                      : "No PTO entries"}
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/people/${record.id}/show/pto`}>View PTO history</Link>
                  </Button>
                  {canManagePeople ? (
                    <Button variant="outline" size="sm" onClick={() => setIsPtoAdjustmentOpen(true)}>
                      Add adjustment
                    </Button>
                  ) : null}
                </div>
              </CardContent>
              </Card>
            ) : null}

            {canSeeTimeEntriesAndPayroll ? (
              <Card>
              <CardHeader>
                <CardTitle>Hours & Payroll Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <p>Hours this week: <span className="font-semibold">{summary.hoursThisWeek.toFixed(2)}</span></p>
                  <p>Hours this pay period: <span className="font-semibold">{summary.hoursThisPayPeriod.toFixed(2)}</span></p>
                  <p>OT hours pay period: <span className="font-semibold">{summary.overtimeHoursThisPayPeriod.toFixed(2)}</span></p>
                  <p>YTD OT hours: <span className="font-semibold">{summary.ytdOvertime.toFixed(2)}</span></p>
                  <p>Last payroll date: <span className="font-semibold">{formatDate(summary.latestPayrollRun?.payday)}</span></p>
                  <p>Last gross pay: <span className="font-semibold">{money(summary.latestPayrollLine?.gross_pay)}</span></p>
                  <p>Last net pay: <span className="font-semibold">{money(summary.latestPayrollLine?.net_pay)}</span></p>
                  <p>YTD gross pay: <span className="font-semibold">{money(summary.ytdGross)}</span></p>
                  {record.compensation_mode === "day_rate" ? (
                    <p>Days worked this pay period: <span className="font-semibold">{summary.daysWorkedThisPayPeriod}</span></p>
                  ) : null}
                </div>
                <p className="text-muted-foreground">
                  Current period: {formatDate(summary.payPeriodRange.start.toISOString())} - {formatDate(summary.payPeriodRange.end.toISOString())}
                </p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/time_entries">View time entries</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/payroll_runs">View payroll history</Link>
                  </Button>
                </div>
              </CardContent>
              </Card>
            ) : null}

            {isEmployee ? (
              <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {record.emergency_contact_name || record.emergency_contact_phone || record.emergency_contact_relationship ? (
                  <>
                    <p><span className="text-muted-foreground">Name:</span> <span className="font-medium">{record.emergency_contact_name ?? "—"}</span></p>
                    <p><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{record.emergency_contact_phone ?? "—"}</span></p>
                    <p><span className="text-muted-foreground">Relationship:</span> <span className="font-medium">{record.emergency_contact_relationship ?? "—"}</span></p>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-muted-foreground">No emergency contact configured.</p>
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to={createPath({ resource: "people", id: record.id, type: "edit" })}
                        state={{ from: location.pathname }}
                      >
                        Add emergency contact
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
              </Card>
            ) : null}

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Assigned Projects</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.assignedProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assigned projects.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Hours Logged</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.assignedProjects.slice(0, 8).map((project) => (
                        <TableRow key={project.id}>
                          <TableCell>{project.name}</TableCell>
                          <TableCell>{project.stage}</TableCell>
                          <TableCell>{project.role}</TableCell>
                          <TableCell>{project.projectHours.toFixed(2)}h</TableCell>
                          <TableCell>
                            {project.stage === "completed" || project.stage === "closed" ? "Closed" : "Active"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="sm">
                              <Link to={`/deals/${project.id}/show`}>
                                <ExternalLink className="size-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {record.notes ? (
                  <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {canSeeTimeEntriesAndPayroll ? (
            <TabsContent
              value="time_entries"
              className={isQuickDetailLayout ? "mt-0 min-h-0 flex-1 overflow-y-auto pr-1" : ""}
            >
          <Card>
            <CardHeader>
              <CardTitle>Time Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {timeEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No time entries for this year.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Day Type</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Payable</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Project</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeEntries.slice(0, 50).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.day_type ?? "worked_day"}</TableCell>
                        <TableCell>{number(entry.hours).toFixed(2)}</TableCell>
                        <TableCell>{number(entry.payable_hours ?? entry.hours).toFixed(2)}</TableCell>
                        <TableCell>{entry.status}</TableCell>
                        <TableCell>{entry.project_id ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          </TabsContent>
        ) : null}

        {canSeeTimeEntriesAndPayroll ? (
            <TabsContent
              value="payroll"
              className={isQuickDetailLayout ? "mt-0 min-h-0 flex-1 overflow-y-auto pr-1" : ""}
            >
          <Card>
            <CardHeader>
              <CardTitle>Payroll History</CardTitle>
            </CardHeader>
            <CardContent>
              {payrollLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payroll lines found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pay Date</TableHead>
                      <TableHead>Compensation</TableHead>
                      <TableHead>Regular Hrs</TableHead>
                      <TableHead>OT Hrs</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollLines.slice(0, 30).map((line) => {
                      const run = payrollRuns.find(
                        (item) => String(item.id) === String(line.payroll_run_id),
                      );
                      return (
                        <TableRow key={line.id}>
                          <TableCell>{formatDate(run?.payday ?? line.created_at)}</TableCell>
                          <TableCell>{line.compensation_type ?? "—"}</TableCell>
                          <TableCell>{number(line.regular_hours).toFixed(2)}</TableCell>
                          <TableCell>{number(line.overtime_hours).toFixed(2)}</TableCell>
                          <TableCell>{money(line.gross_pay)}</TableCell>
                          <TableCell>{money(line.net_pay)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          </TabsContent>
        ) : null}

        {isEmployee ? (
            <TabsContent
              value="pto"
              className={isQuickDetailLayout ? "mt-0 min-h-0 flex-1 overflow-y-auto pr-1" : ""}
            >
          <Card>
            <CardHeader>
              <CardTitle>PTO Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-end">
                {canManagePeople ? (
                  <Button variant="outline" onClick={() => setIsPtoAdjustmentOpen(true)}>
                    Add adjustment
                  </Button>
                ) : null}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Days (8h)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.filter((entry) => isPaidLeaveDay(entry.day_type ?? null)).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        No PTO activity in current period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    timeEntries
                      .filter((entry) => isPaidLeaveDay(entry.day_type ?? null))
                      .slice(0, 30)
                      .map((entry) => {
                        const hours = number(entry.payable_hours ?? entry.hours);
                        return (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.date}</TableCell>
                            <TableCell>{entry.day_type}</TableCell>
                            <TableCell>{hours.toFixed(2)}</TableCell>
                            <TableCell>{(hours / 8).toFixed(2)}</TableCell>
                            <TableCell>{entry.status}</TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>

              <Card>
                <CardHeader>
                  <CardTitle>PTO Adjustment History</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.ptoAdjustments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No PTO adjustments yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Delta Days</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.ptoAdjustments.slice(0, 30).map((adj) => (
                          <TableRow key={adj.id}>
                            <TableCell>{formatDate(adj.adjustment_date)}</TableCell>
                            <TableCell>{adj.adjustment_type}</TableCell>
                            <TableCell>
                              {Number(adj.days_delta) > 0 ? "+" : ""}
                              {Number(adj.days_delta).toFixed(2)}
                            </TableCell>
                            <TableCell>{adj.reason ?? "—"}</TableCell>
                            <TableCell>{adj.notes ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
          </TabsContent>
        ) : null}

        {isEmployee ? (
          <TabsContent
            value="loans"
            className={isQuickDetailLayout ? "mt-0 min-h-0 flex-1 overflow-y-auto pr-1" : ""}
          >
            <Card>
              <CardHeader>
                <CardTitle>Loans & Advances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/employee_loans">Open loans module</Link>
                  </Button>
                </div>

                {employeeLoans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This employee has no loans or advances yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead className="text-right">Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeLoans.map((loan) => {
                        const loanStatus = getLoanStatus(loan);
                        return (
                          <TableRow key={loan.id}>
                            <TableCell>{formatDate(loan.loan_date)}</TableCell>
                            <TableCell>{getLoanRecordTypeLabel(loan.record_type)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  loanStatus === "completed"
                                    ? "secondary"
                                    : loanStatus === "paused"
                                      ? "outline"
                                      : "default"
                                }
                              >
                                {loanStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>{money(loan.original_amount)}</TableCell>
                            <TableCell>{money(loan.remaining_balance)}</TableCell>
                            <TableCell>{getRepaymentSummary(loan)}</TableCell>
                            <TableCell className="text-right">
                              <Button asChild variant="ghost" size="sm">
                                <Link to={`/employee_loans/${loan.id}/show`}>
                                  <ExternalLink className="size-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        <TabsContent
          value="projects"
          className={isQuickDetailLayout ? "mt-0 min-h-0 flex-1 overflow-y-auto pr-1" : ""}
        >
          <Card>
            <CardHeader>
              <CardTitle>Assigned Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.assignedProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assigned projects yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Hours Logged</TableHead>
                      <TableHead>Current Status</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.assignedProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell>{project.name}</TableCell>
                        <TableCell>{project.stage}</TableCell>
                        <TableCell>{project.role}</TableCell>
                        <TableCell>{project.projectHours.toFixed(2)}</TableCell>
                        <TableCell>
                          {project.stage === "completed" || project.stage === "closed"
                            ? "Closed"
                            : "Active"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/deals/${project.id}/show`}>
                              <ExternalLink className="size-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="activity"
          className={isQuickDetailLayout ? "mt-0 min-h-0 flex-1 overflow-y-auto pr-1" : ""}
        >
          <Card>
            <CardHeader>
              <CardTitle>Activity / History</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity found.</p>
              ) : (
                <div className="space-y-3">
                  {summary.activity.map((event, index) => (
                    <div
                      key={`${event.label}-${event.date}-${index}`}
                      className="rounded-md border p-3"
                    >
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(String(event.date))}
                      </p>
                      <p className="text-sm">{event.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={canManagePeople && isPtoAdjustmentOpen}
        onOpenChange={(open) => {
          if (canManagePeople) {
            setIsPtoAdjustmentOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add PTO Adjustment</DialogTitle>
            <DialogDescription>
              Create a formal PTO adjustment with history for this employee.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adjustment_date">Adjustment date</Label>
              <Input
                id="adjustment_date"
                type="date"
                value={adjustmentForm.adjustment_date}
                onChange={(event) =>
                  setAdjustmentForm((prev) => ({
                    ...prev,
                    adjustment_date: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment_type">Adjustment type</Label>
              <select
                id="adjustment_type"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={adjustmentForm.adjustment_type}
                onChange={(event) =>
                  setAdjustmentForm((prev) => ({
                    ...prev,
                    adjustment_type: event.target.value as "sick" | "vacation",
                  }))
                }
              >
                <option value="vacation">Vacation</option>
                <option value="sick">Sick</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="days_delta">Days delta (+/-)</Label>
              <Input
                id="days_delta"
                type="number"
                step="0.25"
                value={adjustmentForm.days_delta}
                onChange={(event) =>
                  setAdjustmentForm((prev) => ({ ...prev, days_delta: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={adjustmentForm.reason}
                onChange={(event) =>
                  setAdjustmentForm((prev) => ({ ...prev, reason: event.target.value }))
                }
                placeholder="Manual correction / accrual / carry over"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={adjustmentForm.notes}
                onChange={(event) =>
                  setAdjustmentForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                placeholder="Optional detail for audit trail"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPtoAdjustmentOpen(false)}
              disabled={isSubmittingAdjustment}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitPtoAdjustment}
              disabled={!canManagePeople || isSubmittingAdjustment}
            >
              {isSubmittingAdjustment ? "Saving..." : "Save adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const PeopleShow = () => (
  <ShowBase>
    <PeopleProfileDetailsContent />
  </ShowBase>
);
