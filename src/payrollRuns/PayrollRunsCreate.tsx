import { useEffect, useMemo } from "react";
import {
  useCreatePath,
  useDataProvider,
  useGetList,
  useGetOne,
  useNotify,
  useRedirect,
  required,
} from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { useSearchParams } from "react-router";
import {
  AutocompleteInput,
  Create,
  DateInput,
  SelectInput,
  SimpleForm,
  TextInput,
} from "@/components/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  PayrollRun,
  Person,
  TimeEntry,
} from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  getCompanyPaySchedule,
  getPersonCompensationProfile,
} from "@/payroll/rules";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

const toIso = (date: Date) => date.toISOString().slice(0, 10);

const endOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getDefaultPeriod = (
  schedule: "weekly" | "biweekly" | "semimonthly" | "monthly",
) => {
  const today = new Date();

  if (schedule === "weekly") {
    const end = addDays(today, 6);
    return {
      pay_period_start: toIso(today),
      pay_period_end: toIso(end),
      payday: toIso(end),
    };
  }

  if (schedule === "biweekly") {
    const end = addDays(today, 13);
    return {
      pay_period_start: toIso(today),
      pay_period_end: toIso(end),
      payday: toIso(end),
    };
  }

  if (schedule === "semimonthly") {
    const day = today.getDate();
    const start =
      day <= 15
        ? new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0)
        : new Date(today.getFullYear(), today.getMonth(), 16, 12, 0, 0, 0);
    const end =
      day <= 15
        ? new Date(today.getFullYear(), today.getMonth(), 15, 12, 0, 0, 0)
        : endOfMonth(today);

    return {
      pay_period_start: toIso(start),
      pay_period_end: toIso(end),
      payday: toIso(end),
    };
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
  const end = endOfMonth(today);
  return {
    pay_period_start: toIso(start),
    pay_period_end: toIso(end),
    payday: toIso(end),
  };
};

const getCategoryForPerson = (
  person?: Partial<Person> | null,
): PayrollRun["category"] => {
  if (!person) return "hourly";
  const profile = getPersonCompensationProfile(person);
  if (profile.unit === "commission") return "sales_commissions";
  if (person.type === "subcontractor") return "subcontractor";
  if (profile.unit === "week" || profile.unit === "month") return "salaried";
  return "hourly";
};

/** Align picker with run category (hourly ↔ Hours approvals, salaried ↔ salary profile, etc.). */
const personMatchesRunCategory = (
  person: Person,
  category: PayrollRun["category"] | undefined,
): boolean => {
  if (!category || category === "mixed") return true;
  return getCategoryForPerson(person) === category;
};

const getPayrollScopeFromSearch = (searchParams: URLSearchParams) =>
  searchParams.get("employee_id") ? "employee" : "all";

const PayrollPeriodDefaults = () => {
  const { setValue, getValues } = useFormContext();
  const paySchedule = useWatch({ name: "pay_schedule" }) as
    | "weekly"
    | "biweekly"
    | "semimonthly"
    | "monthly"
    | undefined;

  useEffect(() => {
    if (!paySchedule) return;

    const currentStart = getValues("pay_period_start");
    const currentEnd = getValues("pay_period_end");
    const currentPayday = getValues("payday");
    const defaultPeriod = getDefaultPeriod(paySchedule);

    if (!currentStart) {
      setValue("pay_period_start", defaultPeriod.pay_period_start, {
        shouldDirty: false,
      });
    }
    if (!currentEnd) {
      setValue("pay_period_end", defaultPeriod.pay_period_end, {
        shouldDirty: false,
      });
    }
    if (!currentPayday) {
      setValue("payday", defaultPeriod.payday, { shouldDirty: false });
    }
  }, [getValues, paySchedule, setValue]);

  return null;
};

const PayrollScopeDefaults = () => {
  const { setValue, getValues, getFieldState } = useFormContext();
  const scope = useWatch({ name: "payroll_scope" }) as
    | "all"
    | "employee"
    | undefined;
  const employeeId = useWatch({ name: "employee_id" }) as
    | number
    | string
    | undefined;
  const { data: employee } = useGetOne<Person>(
    "people",
    { id: employeeId ?? "" },
    {
      enabled: scope === "employee" && employeeId != null && employeeId !== "",
    },
  );

  useEffect(() => {
    if (scope !== "employee" && getValues("employee_id")) {
      setValue("employee_id", null, { shouldDirty: true });
    }
  }, [getValues, scope, setValue]);

  useEffect(() => {
    if (!employee) return;

    if (!getValues("pay_schedule")) {
      setValue("pay_schedule", employee.pay_schedule ?? "biweekly", {
        shouldDirty: false,
      });
    }

    const categoryState = getFieldState("category");
    if (!categoryState.isDirty) {
      setValue("category", getCategoryForPerson(employee), {
        shouldDirty: false,
      });
    }
  }, [employee, getFieldState, getValues, setValue]);

  return null;
};

const PayrollScopeEmployeeInput = () => {
  const { setValue } = useFormContext();
  const scope = useWatch({ name: "payroll_scope" }) as
    | "all"
    | "employee"
    | undefined;
  const category = useWatch({ name: "category" }) as
    | PayrollRun["category"]
    | undefined;
  const employeeId = useWatch({ name: "employee_id" }) as
    | number
    | string
    | undefined;

  const { data: allPeople = [], isPending } = useGetList<Person>("people", {
    pagination: { page: 1, perPage: 5000 },
    sort: { field: "last_name", order: "ASC" },
    filter: { status: "active" },
  });

  const eligiblePeople = useMemo(
    () => allPeople.filter((p) => personMatchesRunCategory(p, category)),
    [allPeople, category],
  );

  const choices = useMemo(
    () =>
      eligiblePeople.map((p) => ({
        id: p.id,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      })),
    [eligiblePeople],
  );

  useEffect(() => {
    if (scope !== "employee" || employeeId == null || employeeId === "") return;
    const ok = eligiblePeople.some((p) => Number(p.id) === Number(employeeId));
    if (!ok) {
      setValue("employee_id", null, { shouldDirty: true });
    }
  }, [eligiblePeople, employeeId, scope, setValue]);

  if (scope !== "employee") return null;

  return (
    <div className="space-y-1.5">
      <AutocompleteInput
        source="employee_id"
        choices={choices}
        label="Employee"
        optionText="name"
        validate={required()}
        placeholder={
          isPending
            ? "Loading employees…"
            : eligiblePeople.length === 0
              ? "No employees match this run type"
              : "Choose employee"
        }
      />
      {category === "hourly" ? (
        <p className="text-xs text-muted-foreground">
          Only hourly and day-rate staff appear here—the same people whose time you approve in
          Hours.
        </p>
      ) : category && category !== "mixed" ? (
        <p className="text-xs text-muted-foreground">
          Only people whose compensation matches this run type are listed.
        </p>
      ) : null}
    </div>
  );
};

const PreviewPanel = () => {
  const category = useWatch({ name: "category" }) as
    | PayrollRun["category"]
    | undefined;
  const scope = useWatch({ name: "payroll_scope" }) as
    | "all"
    | "employee"
    | undefined;
  const employeeId = useWatch({ name: "employee_id" }) as
    | number
    | string
    | undefined;
  const from = useWatch({ name: "pay_period_start" }) as string | undefined;
  const to = useWatch({ name: "pay_period_end" }) as string | undefined;

  const { data: people = [] } = useGetList<Person>("people", {
    pagination: { page: 1, perPage: 5000 },
    sort: { field: "id", order: "ASC" },
    filter: {
      status: "active",
      ...(scope === "employee" && employeeId ? { id: Number(employeeId) } : {}),
    },
  });

  const { data: approvedEntries = [] } = useGetList<TimeEntry>("time_entries", {
    pagination: { page: 1, perPage: 10000 },
    sort: { field: "date", order: "ASC" },
    filter: {
      status: "approved",
      ...(scope === "employee" && employeeId
        ? { person_id: Number(employeeId) }
        : {}),
      ...(from ? { "date@gte": from } : {}),
      ...(to ? { "date@lte": to } : {}),
    },
  });

  const selectedEmployee = people[0];

  const summary = useMemo(() => {
    const map = new Map(people.map((person) => [String(person.id), person]));
    let hourlyEntries = 0;
    let hourlyHours = 0;
    const hourlyEmployees = new Set<string>();
    let salariedEmployees = 0;
    let subcontractors = 0;

    for (const person of people) {
      const compensation = getPersonCompensationProfile(person);
      if (compensation.unit === "week" || compensation.unit === "month") {
        salariedEmployees += 1;
      }
      if (person.type === "subcontractor") subcontractors += 1;
    }

    for (const entry of approvedEntries) {
      const person = map.get(String(entry.person_id));
      if (!person) continue;
      const compensation = getPersonCompensationProfile(person);
      if (compensation.unit === "hour" || compensation.unit === "day") {
        hourlyEntries += 1;
        hourlyHours += Number(entry.payable_hours ?? entry.hours ?? 0);
        hourlyEmployees.add(String(person.id));
      }
    }

    const warnings: string[] = [];
    if (!from || !to)
      warnings.push("Set pay period start/end to compute preview.");
    if (scope === "employee" && !employeeId)
      warnings.push("Choose an employee for this payroll run.");
    if (
      (category === "hourly" || category === "mixed") &&
      hourlyEntries === 0
    ) {
      warnings.push("No approved hourly entries found in the selected period.");
    }
    if (
      (category === "salaried" || category === "mixed") &&
      salariedEmployees === 0
    ) {
      warnings.push("No active salaried employees found in scope.");
    }

    return {
      hourlyEntries,
      hourlyHours: Number(hourlyHours.toFixed(2)),
      hourlyEmployees: hourlyEmployees.size,
      salariedEmployees,
      subcontractors,
      warnings,
    };
  }, [approvedEntries, category, employeeId, from, people, scope, to]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview & Warnings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div>
            Payroll scope:{" "}
            <strong>
              {scope === "employee"
                ? selectedEmployee
                  ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}`
                  : "Selected employee"
                : "All employees"}
            </strong>
          </div>
          <div>
            Category selected: <strong>{category ?? "—"}</strong>
          </div>
          <div>
            Hourly employees ready: <strong>{summary.hourlyEmployees}</strong>
          </div>
          <div>
            Approved hourly entries: <strong>{summary.hourlyEntries}</strong>
          </div>
          <div>
            Approved payable hours: <strong>{summary.hourlyHours}</strong>
          </div>
          <div>
            Salaried employees ready:{" "}
            <strong>{summary.salariedEmployees}</strong>
          </div>
        </div>
        {summary.warnings.length > 0 ? (
          <ul className="space-y-1 text-destructive">
            {summary.warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            Preview looks good. After you save, we&apos;ll try to build payroll
            lines from hours automatically; you can refresh them on the run
            screen if needed.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const PayrollRunsCreateForm = () => {
  const config = useConfigurationContext();
  const [searchParams] = useSearchParams();
  const redirect = useRedirect();
  const createPath = useCreatePath();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const employeeParam = searchParams.get("employee_id");
  const defaultSchedule = getCompanyPaySchedule(config.payrollSettings);

  return (
    <Create
      transform={(data) => {
        const { payroll_scope: _payrollScope, ...rest } = data;
        return rest;
      }}
      mutationOptions={{
        onSuccess: async (result) => {
          const id =
            result?.data?.id ?? (result as { id?: string | number })?.id;
          if (id == null) return;
          try {
            const n = await dataProvider.generatePayrollRun(id);
            notify(
              typeof n === "number" && n > 0
                ? `Payroll lines created (${n}). Review totals, then approve when ready.`
                : "Payroll run saved. Review lines on the next screen, then approve.",
              { type: "success" },
            );
          } catch {
            notify(
              "Payroll run saved. Use “Build payroll lines” on the next screen to pull in hours.",
              { type: "warning" },
            );
          }
          redirect(createPath({ resource: "payroll_runs", id, type: "show" }));
        },
      }}
    >
      <SimpleForm
        className="max-w-none"
        defaultValues={{
          org_id: 1,
          payroll_scope: getPayrollScopeFromSearch(searchParams),
          employee_id: employeeParam ? Number(employeeParam) : null,
          category: "hourly",
          pay_schedule: defaultSchedule,
          ...getDefaultPeriod(defaultSchedule),
          status: "draft",
          created_by: "Current User",
        }}
      >
        <PayrollPeriodDefaults />
        <PayrollScopeDefaults />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
          <div className="space-y-4">
            <SelectInput
              source="payroll_scope"
              choices={[
                { id: "all", name: "All employees" },
                { id: "employee", name: "Single employee" },
              ]}
            />
            <SelectInput
              source="category"
              choices={[
                { id: "hourly", name: "Hourly Staff" },
                { id: "salaried", name: "Salaried Staff" },
                { id: "subcontractor", name: "Subcontractors" },
                { id: "sales_commissions", name: "Sales Commissions" },
                { id: "mixed", name: "Mixed" },
              ]}
            />
            <PayrollScopeEmployeeInput />
            <SelectInput
              source="pay_schedule"
              choices={[
                { id: "weekly", name: "Weekly" },
                { id: "biweekly", name: "Biweekly" },
                { id: "semimonthly", name: "Semi-Monthly" },
                { id: "monthly", name: "Monthly" },
              ]}
            />
            <DateInput source="pay_period_start" validate={required()} />
            <DateInput source="pay_period_end" validate={required()} />
            <DateInput source="payday" validate={required()} />
            <TextInput source="created_by" />
            <TextInput source="notes" multiline />
          </div>

          <div className="xl:sticky xl:top-4">
            <PreviewPanel />
          </div>
        </div>
      </SimpleForm>
    </Create>
  );
};

export const PayrollRunsCreate = () => <PayrollRunsCreateForm />;
