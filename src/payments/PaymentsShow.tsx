import { useEffect, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useGetList, useGetMany, useRecordContext } from "ra-core";
import { Show } from "@/components/admin";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type {
  Deal,
  Payment,
  PaymentLine,
  Person,
  TimeEntry,
} from "@/components/atomic-crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PaymentLinesScope } from "./PaymentLinesTable";
import { PaymentRunActions } from "./PaymentRunActions";

const money = (value?: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value ?? 0),
  );

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  return value.slice(0, 5);
};

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

/** Legacy auto title repeated the same dates as the pay period; hide it in the header when it adds nothing. */
const isRedundantRunName = (
  runName: string | null | undefined,
  record: Pick<Payment, "category" | "pay_period_start" | "pay_period_end">,
) => {
  if (!runName?.trim()) return true;
  const cat = record.category ?? "mixed";
  const legacy = `Payroll ${cat} · ${record.pay_period_start ?? ""} → ${record.pay_period_end ?? ""}`;
  const short = `Payroll · ${cat}`;
  const n = runName.trim();
  return n === legacy.trim() || n === short;
};

const getPaymentStatusClassName = (status?: Payment["status"]) => {
  if (status === "paid")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "approved") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
};

const getPaymentCategoryClassName = (category?: Payment["category"]) => {
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

const getPersonPaymentTypeLabel = (
  line: PaymentLine | undefined,
  person?: Person,
) => {
  if (line?.source_type === "commission" || person?.type === "salesperson")
    return "Commission";
  if (person?.type === "subcontractor") return "Subcontractor";
  if (
    line?.compensation_type === "weekly_salary" ||
    line?.compensation_type === "monthly_salary" ||
    line?.compensation_type === "fixed_salary" ||
    person?.compensation_type === "weekly_salary" ||
    person?.compensation_type === "monthly_salary" ||
    person?.compensation_type === "fixed_salary"
  ) {
    return "Salary";
  }
  return "Hourly";
};

const getPaymentTypeBadgeClassName = (typeLabel: string) => {
  if (typeLabel === "Salary") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (typeLabel === "Commission") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (typeLabel === "Subcontractor") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
};

const filterLinesByScope = (
  lines: PaymentLine[],
  scope: PaymentLinesScope,
  peopleById: Record<string, Person>,
) => {
  if (scope === "all") return lines;
  return lines.filter((line) => {
    const person = peopleById[String(line.person_id)];
    if (scope === "sales_commissions") {
      return (
        line.source_type === "commission" || person?.type === "salesperson"
      );
    }
    if (scope === "salaried") {
      return (
        line.source_type === "salary" ||
        line.compensation_type === "weekly_salary" ||
        line.compensation_type === "monthly_salary" ||
        line.compensation_type === "fixed_salary" ||
        person?.compensation_type === "weekly_salary" ||
        person?.compensation_type === "monthly_salary" ||
        person?.compensation_type === "fixed_salary"
      );
    }
    if (scope === "subcontractor") {
      return person?.type === "subcontractor";
    }
    return (
      line.source_type === "time_entry" ||
      (person?.type === "employee" && line.source_type !== "commission")
    );
  });
};

type PaymentPersonSummary = {
  personId: number;
  personName: string;
  email: string;
  typeLabel: string;
  lineCount: number;
  hours: number;
  deductions: number;
  amount: number;
};

const PaymentPeoplePayoutCenter = ({
  isPending,
  lines,
  people,
}: {
  isPending: boolean;
  lines: PaymentLine[];
  people: Person[];
}) => {
  const peopleById = useMemo(
    () =>
      Object.fromEntries(people.map((person) => [String(person.id), person])),
    [people],
  );

  const summaries = useMemo<PaymentPersonSummary[]>(() => {
    const grouped = new Map<number, PaymentPersonSummary>();

    lines.forEach((line) => {
      const personId = Number(line.person_id);
      if (!personId) return;
      const person = peopleById[String(personId)];
      const personName = person
        ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim()
        : `Person #${personId}`;
      const existing = grouped.get(personId);
      const summary = existing ?? {
        personId,
        personName,
        email: String(person?.email ?? ""),
        typeLabel: getPersonPaymentTypeLabel(line, person),
        lineCount: 0,
        hours: 0,
        deductions: 0,
        amount: 0,
      };

      summary.lineCount += 1;
      summary.hours += Number(line.qty_hours ?? line.regular_hours ?? 0);
      summary.deductions += Number(line.deductions ?? 0);
      summary.amount += Number(line.total_pay ?? line.amount ?? 0);
      grouped.set(personId, summary);
    });

    return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
  }, [lines, peopleById]);

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="border-b text-left">
            <th className="px-3 py-2">Person</th>
            <th className="px-3 py-2">Payment Type</th>
            <th className="px-3 py-2">Payment lines</th>
            <th className="px-3 py-2">Hours</th>
            <th className="px-3 py-2">Deductions</th>
            <th className="px-3 py-2">Amount to pay</th>
          </tr>
        </thead>
        <tbody>
          {isPending ? (
            <tr>
              <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                Loading payment people...
              </td>
            </tr>
          ) : summaries.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                No payment people found in this run.
              </td>
            </tr>
          ) : (
            summaries.map((summary) => (
              <tr key={summary.personId} className="border-b">
                <td className="px-3 py-2.5">
                  <div className="font-medium">{summary.personName}</div>
                  <div className="text-xs text-muted-foreground">
                    {summary.email || "—"}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    variant="outline"
                    className={getPaymentTypeBadgeClassName(summary.typeLabel)}
                  >
                    {summary.typeLabel}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">{summary.lineCount}</td>
                <td className="px-3 py-2.5">{summary.hours.toFixed(2)}</td>
                <td className="px-3 py-2.5">{money(summary.deductions)}</td>
                <td className="px-3 py-2.5 font-semibold">
                  {money(summary.amount)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

const PaymentPrintDocument = ({
  activePersonId,
  lines,
  people,
  projects,
  scope,
}: {
  activePersonId: number | null;
  lines: PaymentLine[];
  people: Person[];
  projects: Deal[];
  scope: PaymentLinesScope;
}) => {
  const record = useRecordContext<Payment>();
  const config = useConfigurationContext();

  const peopleById = useMemo(
    () =>
      Object.fromEntries(people.map((person) => [String(person.id), person])),
    [people],
  );
  const projectsById = useMemo(
    () =>
      Object.fromEntries(
        projects.map((project) => [String(project.id), project]),
      ),
    [projects],
  );

  const scopedLines = useMemo(
    () => filterLinesByScope(lines, scope, peopleById),
    [lines, peopleById, scope],
  );
  const printableLines = useMemo(
    () =>
      activePersonId == null
        ? scopedLines
        : scopedLines.filter(
            (line) => Number(line.person_id) === activePersonId,
          ),
    [activePersonId, scopedLines],
  );

  const selectedPerson =
    activePersonId == null ? undefined : peopleById[String(activePersonId)];
  const totalAmount = printableLines.reduce(
    (sum, line) => sum + Number(line.total_pay ?? line.amount ?? 0),
    0,
  );
  const totalHours = printableLines.reduce(
    (sum, line) => sum + Number(line.qty_hours ?? line.regular_hours ?? 0),
    0,
  );
  const timeEntryIds = useMemo(
    () =>
      printableLines
        .filter(
          (line) => line.source_type === "time_entry" && line.source_id != null,
        )
        .map((line) => line.source_id as number | string),
    [printableLines],
  );
  const { data: timeEntries = [] } = useGetMany<TimeEntry>(
    "time_entries",
    { ids: timeEntryIds },
    { enabled: timeEntryIds.length > 0 },
  );
  const timeEntriesById = useMemo(
    () =>
      Object.fromEntries(timeEntries.map((entry) => [String(entry.id), entry])),
    [timeEntries],
  );
  const companyName = config.companyLegalName?.trim() || config.title;
  const periodLabel = `${formatDate(record?.pay_period_start)} → ${formatDate(record?.pay_period_end)}`;
  const representativeName =
    config.companyRepresentativeName?.trim() ||
    "______________________________";
  const representativeTitle =
    config.companyRepresentativeTitle?.trim() || "Authorized Representative";

  if (!record) return null;

  return (
    <div className="payment-print-only">
      <div className="payment-print-page mx-auto w-full max-w-none bg-white px-4 py-4 text-black">
        <div className="mb-5 flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Payroll Payment Document
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {companyName}
            </h1>
            <p className="mt-1 text-sm text-slate-700">
              {selectedPerson
                ? "Employee payment statement"
                : "Payroll payment summary"}
            </p>
          </div>
          <div className="min-w-[220px] text-right text-sm">
            <p>
              <span className="font-semibold">Payment run:</span> #{record.id}
            </p>
            <p>
              <span className="font-semibold">Category:</span>{" "}
              {record.category ?? "mixed"}
            </p>
            <p>
              <span className="font-semibold">Pay period:</span> {periodLabel}
            </p>
            <p>
              <span className="font-semibold">Payday:</span>{" "}
              {formatDate(record.pay_date)}
            </p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <p>
            <span className="font-semibold">Status:</span> {record.status}
          </p>
          <p>
            <span className="font-semibold">Prepared by:</span>{" "}
            {record.created_by ?? "System"}
          </p>
          <p>
            <span className="font-semibold">
              {selectedPerson ? "Employee:" : "Scope:"}
            </span>{" "}
            {selectedPerson
              ? `${selectedPerson.first_name ?? ""} ${selectedPerson.last_name ?? ""}`.trim()
              : "All people in current scope"}
          </p>
          <p>
            <span className="font-semibold">Lines included:</span>{" "}
            {printableLines.length}
          </p>
          <p>
            <span className="font-semibold">Hours included:</span>{" "}
            {totalHours.toFixed(2)}
          </p>
          <p>
            <span className="font-semibold">Amount included:</span>{" "}
            {money(totalAmount)}
          </p>
        </div>

        {selectedPerson ? (
          <>
            <div className="mb-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <p>
                <span className="font-semibold">Employee:</span>{" "}
                {`${selectedPerson.first_name ?? ""} ${selectedPerson.last_name ?? ""}`.trim()}
              </p>
              <p>
                <span className="font-semibold">Payment type:</span>{" "}
                {getPersonPaymentTypeLabel(printableLines[0], selectedPerson)}
              </p>
              <p>
                <span className="font-semibold">Email:</span>{" "}
                {selectedPerson.email ?? "—"}
              </p>
              <p>
                <span className="font-semibold">Phone:</span>{" "}
                {selectedPerson.phone ?? "—"}
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Address</th>
                    <th className="px-3 py-2 font-medium">In</th>
                    <th className="px-3 py-2 font-medium">Out</th>
                    <th className="px-3 py-2 font-medium">Lunch</th>
                    <th className="px-3 py-2 font-medium">Hours</th>
                    <th className="px-3 py-2 font-medium">Day pay</th>
                    <th className="px-3 py-2 font-medium">Deductions</th>
                  </tr>
                </thead>
                <tbody>
                  {printableLines.map((line) => {
                    const timeEntry =
                      line.source_type === "time_entry" &&
                      line.source_id != null
                        ? timeEntriesById[String(line.source_id)]
                        : undefined;

                    return (
                      <tr
                        key={line.id}
                        className="border-t border-slate-100 align-top"
                      >
                        <td className="px-3 py-2">
                          {formatDate(timeEntry?.date ?? record.pay_date)}
                        </td>
                        <td className="px-3 py-2">
                          {timeEntry?.work_location ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {formatTime(timeEntry?.start_time)}
                        </td>
                        <td className="px-3 py-2">
                          {formatTime(timeEntry?.end_time)}
                        </td>
                        <td className="px-3 py-2">
                          {timeEntry?.lunch_minutes != null
                            ? `${timeEntry.lunch_minutes} min`
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {Number(
                            line.qty_hours ??
                              line.regular_hours ??
                              timeEntry?.payable_hours ??
                              0,
                          ) > 0
                            ? Number(
                                line.qty_hours ??
                                  line.regular_hours ??
                                  timeEntry?.payable_hours ??
                                  0,
                              ).toFixed(2)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {money(line.total_pay ?? line.amount)}
                        </td>
                        <td className="px-3 py-2">{money(line.deductions)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                    <td className="px-3 py-2" colSpan={5}>
                      Total
                    </td>
                    <td className="px-3 py-2">{totalHours.toFixed(2)}</td>
                    <td className="px-3 py-2">{money(totalAmount)}</td>
                    <td className="px-3 py-2">
                      {money(
                        printableLines.reduce(
                          (sum, line) => sum + Number(line.deductions ?? 0),
                          0,
                        ),
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-10 text-sm">
              <div>
                <p className="font-semibold">Employee Signature</p>
                <p className="mt-8">______________________________</p>
                <p className="mt-2 text-slate-600">
                  Date: ____________________
                </p>
              </div>
              <div>
                <p className="font-semibold">
                  Company Representative Signature
                </p>
                <p className="mt-8">{representativeName}</p>
                <p className="text-slate-600">{representativeTitle}</p>
                <p className="mt-2 text-slate-600">
                  Date: ____________________
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Person</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 font-medium">Hours</th>
                  <th className="px-3 py-2 font-medium">Rate</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {printableLines.map((line) => {
                  const person = peopleById[String(line.person_id)];
                  const project = line.project_id
                    ? projectsById[String(line.project_id)]
                    : undefined;
                  const personName = person
                    ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim()
                    : "—";

                  return (
                    <tr
                      key={line.id}
                      className="border-t border-slate-100 align-top"
                    >
                      <td className="px-3 py-2">{personName}</td>
                      <td className="px-3 py-2">
                        {getPersonPaymentTypeLabel(line, person)}
                      </td>
                      <td className="px-3 py-2">{line.source_type}</td>
                      <td className="px-3 py-2">{project?.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        {Number(line.qty_hours ?? line.regular_hours ?? 0) > 0
                          ? Number(
                              line.qty_hours ?? line.regular_hours ?? 0,
                            ).toFixed(2)
                          : "—"}
                      </td>
                      <td className="px-3 py-2">{money(line.rate)}</td>
                      <td className="px-3 py-2 font-medium">
                        {money(line.total_pay ?? line.amount)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {line.notes ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td className="px-3 py-2" colSpan={4}>
                    Total
                  </td>
                  <td className="px-3 py-2">{totalHours.toFixed(2)}</td>
                  <td className="px-3 py-2">—</td>
                  <td className="px-3 py-2">{money(totalAmount)}</td>
                  <td className="px-3 py-2">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const PaymentsShowContent = ({
  variant = "page",
}: {
  variant?: "page" | "dialog";
} = {}) => {
  const record = useRecordContext<Payment>();
  const scope: PaymentLinesScope = "all";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDialog = variant === "dialog";

  const isPrintMode = searchParams.get("print") === "1";
  const printPersonId = searchParams.get("person_id");
  const printScope =
    (searchParams.get("scope") as PaymentLinesScope | null) ?? "all";

  const { data: lines = [], isPending } = useGetList<PaymentLine>(
    "payment_lines",
    {
      pagination: { page: 1, perPage: 2000 },
      sort: { field: "id", order: "ASC" },
      filter: { payment_id: record?.id },
    },
    { enabled: Boolean(record?.id) },
  );

  const personIds = useMemo(
    () =>
      Array.from(
        new Set(
          lines
            .map((line) => line.person_id)
            .filter((id): id is NonNullable<typeof id> => id != null),
        ),
      ),
    [lines],
  );
  const projectIds = useMemo(
    () =>
      Array.from(
        new Set(
          lines
            .map((line) => line.project_id)
            .filter((id): id is NonNullable<typeof id> => id != null),
        ),
      ),
    [lines],
  );

  const { data: people = [] } = useGetMany<Person>(
    "people",
    { ids: personIds },
    { enabled: personIds.length > 0 },
  );
  const { data: projects = [] } = useGetMany<Deal>(
    "deals",
    { ids: projectIds },
    { enabled: projectIds.length > 0 },
  );

  useEffect(() => {
    if (!isPrintMode || isPending || !record) return;
    const frame = window.requestAnimationFrame(() => {
      window.print();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isPending, isPrintMode, record]);

  if (!record) return null;

  if (isPrintMode) {
    return (
      <PaymentPrintDocument
        activePersonId={printPersonId ? Number(printPersonId) : null}
        lines={lines}
        people={people}
        projects={projects}
        scope={printScope}
      />
    );
  }

  return (
    <div className={cn("space-y-4", isDialog && "space-y-3")}>
      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-5">
          {!isDialog ? (
            <div>
              <Button
                type="button"
                variant="ghost"
                className="-ml-3 h-8 px-2"
                onClick={() => navigate("/payments")}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Regresar
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={getPaymentCategoryClassName(
                    record.category ?? "hourly",
                  )}
                >
                  {record.category ?? "mixed"}
                </Badge>
                <Badge
                  variant="outline"
                  className={getPaymentStatusClassName(record.status)}
                >
                  {record.status}
                </Badge>
              </div>
              <div>
                <h1
                  className={cn(
                    "font-semibold tracking-tight text-slate-950",
                    isDialog ? "text-2xl sm:text-3xl" : "text-3xl",
                  )}
                >
                  Payment #{record.id}
                </h1>
                <p className="text-sm text-slate-600">
                  Pay period {formatDate(record.pay_period_start)} –{" "}
                  {formatDate(record.pay_period_end)}
                  {record.pay_date
                    ? ` · Payday ${formatDate(record.pay_date)}`
                    : null}
                </p>
                {!isRedundantRunName(record.run_name, record) ? (
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {record.run_name}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-slate-500">
                  Review approved payroll lines, confirm totals, then close the
                  payout as paid.
                </p>
                {record.payroll_run_id != null ? (
                  <p className="mt-2 text-sm">
                    <Link
                      to={`/time_entries?payroll_run_id=${record.payroll_run_id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Hour lines for this payroll run
                    </Link>{" "}
                    — same entries as on the run, in Hours.
                  </p>
                ) : null}
                {record.approved_receipt_url || record.paid_receipt_url ? (
                  <div className="mt-3 flex flex-wrap gap-4">
                    {record.approved_receipt_url ? (
                      <a
                        href={record.approved_receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        <span className="mb-1 block text-xs text-muted-foreground">
                          Approval proof
                        </span>
                        <img
                          src={record.approved_receipt_url}
                          alt=""
                          className="h-20 max-w-[200px] rounded-md border object-cover"
                        />
                      </a>
                    ) : null}
                    {record.paid_receipt_url ? (
                      <a
                        href={record.paid_receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        <span className="mb-1 block text-xs text-muted-foreground">
                          Paid proof
                        </span>
                        <img
                          src={record.paid_receipt_url}
                          alt=""
                          className="h-20 max-w-[200px] rounded-md border object-cover"
                        />
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <PaymentPeoplePayoutCenter
          isPending={isPending}
          lines={lines}
          people={people}
        />
        <div className="flex justify-end">
          <PaymentRunActions scope={scope} />
        </div>
      </div>
    </div>
  );
};

export const PaymentsShow = () => (
  <Show actions={false} title={false}>
    <PaymentsShowContent variant="page" />
  </Show>
);
