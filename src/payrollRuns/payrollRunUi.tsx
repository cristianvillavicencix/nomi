import { useEffect, useMemo, useState } from "react";
import { useGetMany } from "ra-core";
import { PanelLeftClose, PanelRightOpen, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  Payment,
  PayrollRun,
  PayrollRunLine,
  Person,
} from "@/components/atomic-crm/types";
import { cn } from "@/lib/utils";
import { getPersonCompensationProfile } from "@/payroll/rules";
import { PayrollRunLinesTableForData } from "./PayrollRunLinesTable";

export const getPayrollStatusClassName = (status?: PayrollRun["status"]) => {
  if (status === "paid")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "approved") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "reviewed")
    return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "cancelled") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
};

export const getPayrollCategoryClassName = (
  category?: PayrollRun["category"],
) => {
  if (category === "salaried")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (category === "sales_commissions")
    return "border-amber-200 bg-amber-50 text-amber-700";
  if (category === "subcontractor")
    return "border-slate-200 bg-slate-100 text-slate-700";
  if (category === "mixed")
    return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
};

const getEmployeePayrollTypeLabel = (person: Person) => {
  const profile = getPersonCompensationProfile(person);
  if (person.type === "subcontractor") return "Subcontractor";
  if (profile.unit === "week" || profile.unit === "month") return "Salary";
  if (profile.unit === "commission") return "Commission";
  return "Hourly";
};

const getEmployeePayrollTypeClassName = (
  typeLabel: string,
  isActive: boolean,
) => {
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

type PayrollRunLinesExplorerProps = {
  lines: PayrollRunLine[];
  isPending?: boolean;
};

export const PayrollRunLinesExplorer = ({
  lines,
  isPending = false,
}: PayrollRunLinesExplorerProps) => {
  const [query, setQuery] = useState("");
  const [activeEmployeeId, setActiveEmployeeId] = useState<number | null>(null);
  const [minimized, setMinimized] = useState(false);

  const employeeIds = useMemo(
    () =>
      Array.from(
        new Set(lines.map((line) => Number(line.employee_id)).filter(Boolean)),
      ),
    [lines],
  );

  const { data: employees = [], isPending: isEmployeesPending } =
    useGetMany<Person>(
      "people",
      { ids: employeeIds },
      { enabled: employeeIds.length > 0 },
    );

  const filteredEmployees = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) => {
      const name = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`
        .trim()
        .toLowerCase();
      const email = String(employee.email ?? "").toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [employees, query]);

  const filteredLines = useMemo(
    () =>
      activeEmployeeId == null
        ? lines
        : lines.filter((line) => Number(line.employee_id) === activeEmployeeId),
    [activeEmployeeId, lines],
  );

  const selectionStillExists = useMemo(
    () =>
      employees.some((employee) => Number(employee.id) === activeEmployeeId),
    [activeEmployeeId, employees],
  );

  useEffect(() => {
    if (activeEmployeeId != null && !selectionStillExists) {
      setActiveEmployeeId(null);
    }
  }, [activeEmployeeId, selectionStillExists]);

  const allCount = lines.length;

  return (
    <div className="flex h-full min-h-0 gap-3 overflow-hidden">
      {minimized ? (
        <aside className="hidden h-full min-h-0 w-12 shrink-0 self-start xl:flex flex-col items-center py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMinimized(false)}
            aria-label="Expand payroll people panel"
            title="Expand payroll people panel"
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
          <span className="mt-4 rotate-180 text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
            People
          </span>
        </aside>
      ) : (
        <aside className="hidden h-full min-h-0 w-[20rem] shrink-0 self-start xl:flex flex-col">
          <div className="space-y-3 px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">People</h3>
                <p className="text-xs text-muted-foreground">
                  Quick navigation
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMinimized(true)}
                aria-label="Minimize payroll people panel"
                title="Minimize payroll people panel"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search people (${employees.length})`}
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
              onClick={() => setActiveEmployeeId(null)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">All people</span>
                <Badge
                  variant="secondary"
                  className="px-2 py-0 text-[10px] uppercase tracking-wide"
                >
                  {allCount} lines
                </Badge>
              </div>
            </button>
            {isEmployeesPending ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="px-1 py-2 text-sm text-muted-foreground">
                No people found.
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredEmployees.map((employee) => {
                  const isActive = Number(employee.id) === activeEmployeeId;
                  const typeLabel = getEmployeePayrollTypeLabel(employee);
                  const employeeLines = lines.filter(
                    (line) => Number(line.employee_id) === Number(employee.id),
                  ).length;
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-all hover:bg-muted/60",
                        isActive &&
                          "border-primary/50 bg-secondary/70 shadow-sm ring-1 ring-primary/10",
                      )}
                      onClick={() => setActiveEmployeeId(Number(employee.id))}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium">
                            {`${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {employee.email || `${employeeLines} payroll lines`}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 px-2 py-0 text-[10px] uppercase tracking-wide",
                            getEmployeePayrollTypeClassName(
                              typeLabel,
                              isActive,
                            ),
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
      )}

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <PayrollRunLinesTableForData
          lines={filteredLines}
          isPending={isPending}
        />
      </div>
    </div>
  );
};

type PayrollRunHeaderBadgesProps = {
  record: PayrollRun;
  employeeName?: string;
  /** When set and paid, status badge shows paid even if payroll_runs row is not synced yet */
  linkedPayment?: Payment | null;
};

export const PayrollRunHeaderBadges = ({
  record,
  employeeName,
  linkedPayment,
}: PayrollRunHeaderBadgesProps) => {
  const displayStatus: PayrollRun["status"] =
    record.status === "paid"
      ? "paid"
      : linkedPayment?.status === "paid"
        ? "paid"
        : record.status;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant="outline"
        className={getPayrollCategoryClassName(record.category)}
      >
        {record.category}
      </Badge>
      <Badge
        variant="outline"
        className={getPayrollStatusClassName(displayStatus)}
      >
        {displayStatus}
      </Badge>
      <Badge variant="outline">{record.pay_schedule}</Badge>
      <Badge variant="outline">{employeeName ?? "All employees"}</Badge>
    </div>
  );
};
