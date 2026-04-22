import { useMemo, useState } from "react";
import { Link } from "react-router";
import { type Identifier, useGetIdentity, useGetList } from "ra-core";
import { FileSpreadsheet, Mail, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACTION_BAR_SURFACE_CLASSNAME } from "@/components/atomic-crm/layout/TopToolbar";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Payment,
  PaymentLine,
  Person,
} from "@/components/atomic-crm/types";
import { canUseCrmPermission } from "@/components/atomic-crm/providers/commons/crmPermissions";
import { getPersonCompensationProfile } from "@/payroll/rules";
import { PaymentDetailDialog } from "@/payments/PaymentDetailDialog";
import { PaymentRegisterPaidDialog } from "@/payments/PaymentRegisterPaidDialog";
import { buildPaymentPrintUrl } from "@/payments/paymentPrintUrl";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type PayrollCategory =
  | "hourly"
  | "salaried"
  | "subcontractor"
  | "sales_commissions";

const categoryTabs: Array<{ value: PayrollCategory; label: string }> = [
  { value: "hourly", label: "Hourly Staff" },
  { value: "salaried", label: "Salaried Staff" },
  { value: "subcontractor", label: "Subcontractors" },
  { value: "sales_commissions", label: "Sales Commissions" },
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );

const formatPayDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/** Collapse legacy auto titles that duplicated the pay period column. */
const paymentRunDisplayName = (payment: Payment) => {
  const cat = payment.category ?? "mixed";
  const legacy = `Payroll ${cat} · ${payment.pay_period_start ?? ""} → ${payment.pay_period_end ?? ""}`;
  const raw = payment.run_name?.trim();
  if (raw === legacy.trim()) return `Payroll · ${cat}`;
  return (
    raw ??
    `Run ${payment.id} (${payment.pay_period_start} - ${payment.pay_period_end})`
  );
};

const lineBelongsToCategory = (
  line: PaymentLine,
  person: Person | undefined,
  category: PayrollCategory,
) => {
  const compensation = person ? getPersonCompensationProfile(person) : null;

  if (category === "hourly") {
    return (
      compensation?.unit === "hour" ||
      compensation?.unit === "day" ||
      line.compensation_unit === "hour" ||
      line.compensation_unit === "day" ||
      line.compensation_type === "hourly" ||
      line.compensation_type === "daily" ||
      line.source_type === "time_entry"
    );
  }
  if (category === "salaried") {
    return (
      compensation?.unit === "week" ||
      compensation?.unit === "month" ||
      line.compensation_unit === "week" ||
      line.compensation_unit === "month" ||
      line.compensation_type === "weekly_salary" ||
      line.compensation_type === "monthly_salary" ||
      line.compensation_type === "fixed_salary" ||
      line.source_type === "salary"
    );
  }
  if (category === "subcontractor") {
    return person?.type === "subcontractor";
  }
  return line.source_type === "commission" || person?.type === "salesperson";
};

const sumLineTotal = (line: PaymentLine) => {
  if (line.total_pay != null) return Number(line.total_pay);
  return Number(line.amount ?? 0);
};

/** Opens default mail client with payment summary and links (print + detail). */
const buildPaymentEmailHref = (payment: Payment) => {
  const printUrl = buildPaymentPrintUrl({
    paymentId: payment.id,
    scope: "all",
  });
  const showUrl = `${window.location.origin}${window.location.pathname}#/payments/${payment.id}/show`;
  const subject = encodeURIComponent(
    `${paymentRunDisplayName(payment)} (#${payment.id})`,
  );
  const body = encodeURIComponent(
    [
      `Corrida de pago: ${paymentRunDisplayName(payment)}`,
      `Período: ${payment.pay_period_start} – ${payment.pay_period_end}`,
      `Estado: ${payment.status}`,
      "",
      `Imprimir: ${printUrl}`,
      `Detalle: ${showUrl}`,
    ].join("\n"),
  );
  return `mailto:?subject=${subject}&body=${body}`;
};

const PaymentRunsTable = ({
  payments,
  paymentLines,
  peopleById,
  category,
  onOpenPaymentRow,
}: {
  payments: Payment[];
  paymentLines: PaymentLine[];
  peopleById: Record<string, Person>;
  category: PayrollCategory;
  onOpenPaymentRow: (id: Identifier) => void;
}) => {
  const rows = useMemo(() => {
    const linesByRun = paymentLines.reduce<Record<string, PaymentLine[]>>(
      (acc, line) => {
        const runId = String(line.payment_id);
        if (!acc[runId]) acc[runId] = [];
        acc[runId].push(line);
        return acc;
      },
      {},
    );

    return payments
      .map((payment) => {
        const runLines = (linesByRun[String(payment.id)] ?? []).filter((line) =>
          lineBelongsToCategory(
            line,
            peopleById[String(line.person_id)],
            category,
          ),
        );

        const employeeCount = new Set(
          runLines.map((line) => String(line.person_id)),
        ).size;
        const grossTotal = runLines.reduce(
          (sum, line) => sum + sumLineTotal(line),
          0,
        );
        const runCategory = payment.category ?? "mixed";
        const categoryMatches =
          runCategory === category || runCategory === "mixed";

        return {
          payment,
          runName: paymentRunDisplayName(payment),
          runCategory,
          employeeCount,
          grossTotal,
          categoryMatches,
        };
      })
      .filter(
        (row) =>
          row.categoryMatches && (row.employeeCount > 0 || row.grossTotal > 0),
      );
  }, [category, paymentLines, payments, peopleById]);

  if (!rows.length) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        No payment runs yet for this category.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="border-b text-left">
            <th className="px-3 py-2">Run name</th>
            <th className="px-3 py-2">Pay period</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Employees</th>
            <th className="px-3 py-2">Gross total</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created by</th>
            <th className="px-3 py-2">Created date</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(
            ({ payment, runName, runCategory, employeeCount, grossTotal }) => (
              <tr
                key={payment.id}
                className="border-b cursor-pointer hover:bg-muted/50"
                role="button"
                tabIndex={0}
                onClick={() => onOpenPaymentRow(payment.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenPaymentRow(payment.id);
                  }
                }}
              >
                <td className="px-3 py-2 font-medium">{runName}</td>
                <td className="px-3 py-2">
                  {formatPayDate(payment.pay_period_start)} –{" "}
                  {formatPayDate(payment.pay_period_end)}
                </td>
                <td className="px-3 py-2">{runCategory}</td>
                <td className="px-3 py-2">{employeeCount}</td>
                <td className="px-3 py-2">{formatMoney(grossTotal)}</td>
                <td className="px-3 py-2 capitalize">{payment.status}</td>
                <td className="px-3 py-2">{payment.created_by ?? "System"}</td>
                <td className="px-3 py-2">
                  {payment.created_at?.slice(0, 10) ?? "-"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-0.5">
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <a
                            href={buildPaymentPrintUrl({
                              paymentId: payment.id,
                              scope: "all",
                            })}
                            aria-label="Print payment"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <Printer className="h-4 w-4" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Print</TooltipContent>
                    </Tooltip>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <a
                            href={buildPaymentEmailHref(payment)}
                            aria-label="Enviar por correo"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <Mail className="h-4 w-4" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Enviar por correo</TooltipContent>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

export type PaymentsListContentProps = {
  /** When true (Payments tab inside Payroll), hides toolbar actions and export — table only. */
  embedded?: boolean;
};

export const PaymentsListContent = ({
  embedded = false,
}: PaymentsListContentProps) => {
  const [category, setCategory] = useState<PayrollCategory>("hourly");
  const [paymentDialogId, setPaymentDialogId] = useState<Identifier | null>(
    null,
  );
  const [registerPickerOpen, setRegisterPickerOpen] = useState(false);
  const [registerPayId, setRegisterPayId] = useState<Identifier | null>(null);
  const { data: identity } = useGetIdentity();
  const canManagePayments = canUseCrmPermission(
    identity as any,
    "payments.manage",
  );
  const canRegisterPay = canUseCrmPermission(identity as any, "payments.pay");

  const { data: people = [] } = useGetList<Person>("people", {
    pagination: { page: 1, perPage: 2000 },
    sort: { field: "id", order: "ASC" },
  });

  const { data: payments = [], isPending: paymentsPending } =
    useGetList<Payment>("payments", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "pay_date", order: "DESC" },
    });

  const { data: paymentLines = [], isPending: linesPending } =
    useGetList<PaymentLine>("payment_lines", {
      pagination: { page: 1, perPage: 10000 },
      sort: { field: "id", order: "DESC" },
    });

  const peopleById = useMemo(
    () =>
      people.reduce<Record<string, Person>>((acc, person) => {
        acc[String(person.id)] = person;
        return acc;
      }, {}),
    [people],
  );

  const unpaidPayments = useMemo(
    () =>
      payments
        .filter((p) => p.status !== "paid")
        .slice()
        .sort((a, b) => {
          const da = a.pay_date ?? "";
          const db = b.pay_date ?? "";
          return db.localeCompare(da);
        }),
    [payments],
  );

  const loading = paymentsPending || linesPending;

  return (
    <div className="space-y-4">
      {!embedded ? (
        <div
          className={`flex flex-wrap items-center justify-end gap-3 ${ACTION_BAR_SURFACE_CLASSNAME}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {canManagePayments ? (
              <Button asChild>
                <Link to="/payments/create">New Payment Run</Link>
              </Button>
            ) : null}
            {canRegisterPay ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegisterPickerOpen(true)}
              >
                Aprobar pago
              </Button>
            ) : null}
            <ModuleInfoPopover
              title="Payments"
              description="Payment runs group what you owe for a date range. Generate lines from approved hours, salaries, or commissions—then approve and mark paid."
              bullets={[
                "Pick a pay period that matches the work you are paying.",
                "Generate lines to pull time entries and other compensation into one run.",
                "Open the help on Payroll if you need loan deductions tied to pay periods.",
              ]}
              contextTitle="Payment runs"
              contextDescription={
                <>
                  Use this area to build{" "}
                  <strong>detailed payment batches</strong> (lines per person).
                  For periods where you need <strong>loan repayments</strong>{" "}
                  and a formal payroll status, use{" "}
                  <Link
                    to="/payroll_runs"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Payroll
                  </Link>
                  — you can still link a payment record to a payroll run when
                  you pay out.
                </>
              }
            />
          </div>
        </div>
      ) : null}

      <Tabs
        value={category}
        onValueChange={(value) => setCategory(value as PayrollCategory)}
      >
        <TabsList>
          {categoryTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="hourly" className="space-y-4 pt-4">
          {loading ? null : (
            <PaymentRunsTable
              payments={payments}
              paymentLines={paymentLines}
              peopleById={peopleById}
              category="hourly"
              onOpenPaymentRow={(id) => setPaymentDialogId(id)}
            />
          )}
        </TabsContent>

        <TabsContent value="salaried" className="space-y-4 pt-4">
          {loading ? null : (
            <PaymentRunsTable
              payments={payments}
              paymentLines={paymentLines}
              peopleById={peopleById}
              category="salaried"
              onOpenPaymentRow={(id) => setPaymentDialogId(id)}
            />
          )}
        </TabsContent>

        <TabsContent value="subcontractor" className="space-y-4 pt-4">
          {loading ? null : (
            <PaymentRunsTable
              payments={payments}
              paymentLines={paymentLines}
              peopleById={peopleById}
              category="subcontractor"
              onOpenPaymentRow={(id) => setPaymentDialogId(id)}
            />
          )}
        </TabsContent>

        <TabsContent value="sales_commissions" className="space-y-4 pt-4">
          {loading ? null : (
            <PaymentRunsTable
              payments={payments}
              paymentLines={paymentLines}
              peopleById={peopleById}
              category="sales_commissions"
              onOpenPaymentRow={(id) => setPaymentDialogId(id)}
            />
          )}
        </TabsContent>
      </Tabs>

      <PaymentDetailDialog
        paymentId={paymentDialogId}
        open={paymentDialogId != null}
        onOpenChange={(open) => {
          if (!open) setPaymentDialogId(null);
        }}
      />

      {!embedded ? (
        <>
          <Dialog open={registerPickerOpen} onOpenChange={setRegisterPickerOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Elegir corrida de pago</DialogTitle>
                <DialogDescription>
                  Elige la corrida donde registrarás el pago; luego sube el
                  comprobante (vale para todas las personas de esa corrida).
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[min(50vh,360px)] space-y-1 overflow-y-auto">
                {unpaidPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay corridas pendientes de registrar como pagadas.
                  </p>
                ) : (
                  unpaidPayments.map((p) => (
                    <button
                      key={String(p.id)}
                      type="button"
                      className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setRegisterPayId(p.id);
                        setRegisterPickerOpen(false);
                      }}
                    >
                      <div className="font-medium">
                        {paymentRunDisplayName(p)}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {p.status} · {formatPayDate(p.pay_period_start)} –{" "}
                        {formatPayDate(p.pay_period_end)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>

          <PaymentRegisterPaidDialog
            paymentId={registerPayId}
            open={registerPayId != null}
            onOpenChange={(o) => {
              if (!o) setRegisterPayId(null);
            }}
          />
        </>
      ) : null}

      {!embedded ? (
        <div className="flex items-center justify-end">
          <Button variant="outline" asChild>
            <Link to="/reports/payroll-summary">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Payroll Summary
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export const PaymentsList = () => <PaymentsListContent />;
