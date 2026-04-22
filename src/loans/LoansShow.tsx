import { Confirm, EditButton, Show } from '@/components/admin';
import { useConfigurationContext } from '@/components/atomic-crm/root/ConfigurationContext';
import type { EmployeeLoan, EmployeeLoanDeduction, Person } from '@/components/atomic-crm/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { buildReceiptNumber, getLoanRecordTypeLabel, getLoanStatus, getRepaymentSummary } from './helpers';
import { getCompanyPaySchedule } from '@/payroll/rules';
import { ChevronLeft, Pause, Pencil, Play, Printer, Trash2, Wallet, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCreate, useCreatePath, useDelete, useGetList, useGetOne, useNotify, useRecordContext, useRefresh, useUpdate } from 'ra-core';
import { useNavigate, useSearchParams } from 'react-router';

const money = (value?: number | null) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));

const roundMoney = (value: number) => Number(value.toFixed(2));

const parseIsoDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return '—';
  const date = parseIsoDate(value);
  if (!date) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const endOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0);

const nextSemiMonthlyDate = (date: Date) => {
  const day = date.getDate();
  if (day < 15) return new Date(date.getFullYear(), date.getMonth(), 15, 12, 0, 0, 0);
  return endOfMonth(date);
};

const nextMonthlyDate = (date: Date) => endOfMonth(date);

const nextPayrollDate = (
  date: Date,
  schedule: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly',
) => {
  if (schedule === 'weekly') return addDays(date, 7);
  if (schedule === 'biweekly') return addDays(date, 14);
  if (schedule === 'semimonthly') return nextSemiMonthlyDate(addDays(date, 1));
  return nextMonthlyDate(addDays(date, 1));
};

const getPayScheduleLabel = (value?: string | null) => {
  if (value === 'specific_pay_date') return 'Specific first deduction date';
  return 'Next payroll cycle';
};

const getStatusBadgeVariant = (status: string) => {
  if (status === 'completed') return 'secondary';
  if (status === 'paused') return 'outline';
  return 'default';
};

const joinParts = (...parts: Array<string | null | undefined>) =>
  parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');

type ProjectedDeduction = {
  amount: number;
  deductionDate: string;
  remainingAfter: number;
  step: number;
};

type AmortizationRow = {
  deductionDate: string;
  installment: number;
  remainingAfter: number;
  step: number;
};

const buildProjectedDeductions = ({
  deductions,
  loan,
  schedule,
}: {
  deductions: EmployeeLoanDeduction[];
  loan: EmployeeLoan;
  schedule: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
}): ProjectedDeduction[] => {
  const remainingBalance = Number(loan.remaining_balance ?? 0);
  const installmentAmount = Math.max(
    0.01,
    Number(loan.fixed_installment_amount ?? remainingBalance ?? 0.01),
  );

  if (remainingBalance <= 0 || loan.status === 'completed' || loan.status === 'cancelled') {
    return [];
  }

  const lastDeductionDate = deductions.length
    ? parseIsoDate(deductions[deductions.length - 1]?.deduction_date)
    : null;
  const firstProjectedDate =
    lastDeductionDate != null
      ? nextPayrollDate(lastDeductionDate, schedule)
      : loan.repayment_schedule === 'specific_pay_date' && loan.first_deduction_date
        ? parseIsoDate(loan.first_deduction_date)
        : (() => {
            const loanDate = parseIsoDate(loan.loan_date);
            return loanDate ? nextPayrollDate(loanDate, schedule) : new Date();
          })();

  let cursor = firstProjectedDate ?? new Date();
  let balance = remainingBalance;
  const rows: ProjectedDeduction[] = [];

  for (let step = 1; step <= 36 && balance > 0; step += 1) {
    const amount = roundMoney(Math.min(balance, installmentAmount));
    balance = roundMoney(Math.max(0, balance - amount));
    rows.push({
      step,
      amount,
      deductionDate: toIsoDate(cursor),
      remainingAfter: balance,
    });
    cursor = nextPayrollDate(cursor, schedule);
  }

  return rows;
};

const buildAmortizationSchedule = ({
  loan,
  schedule,
}: {
  loan: EmployeeLoan;
  schedule: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
}): AmortizationRow[] => {
  const principal = roundMoney(Number(loan.original_amount ?? 0));
  if (principal <= 0) return [];

  const installment = Math.max(
    0.01,
    roundMoney(Number(loan.fixed_installment_amount ?? principal)),
  );
  const plannedCount = Math.max(
    1,
    Number(loan.payment_count ?? (loan.record_type === 'advance' ? 1 : 1)),
  );
  const firstDate =
    loan.repayment_schedule === 'specific_pay_date' && loan.first_deduction_date
      ? parseIsoDate(loan.first_deduction_date)
      : (() => {
          const loanDate = parseIsoDate(loan.loan_date);
          return loanDate ? nextPayrollDate(loanDate, schedule) : new Date();
        })();

  let cursor = firstDate ?? new Date();
  let balance = principal;
  const rows: AmortizationRow[] = [];
  let step = 1;

  while (balance > 0 && step <= Math.max(120, plannedCount)) {
    const payment = roundMoney(Math.min(balance, installment));
    balance = roundMoney(Math.max(0, balance - payment));
    rows.push({
      step,
      installment: payment,
      deductionDate: toIsoDate(cursor),
      remainingAfter: balance,
    });
    cursor = nextPayrollDate(cursor, schedule);
    step += 1;
    if (step > plannedCount && balance <= 0) break;
  }

  return rows;
};

const LoanMetricCard = ({
  label,
  value,
  hint,
}: {
  hint?: string;
  label: string;
  value: string;
}) => (
  <Card className="border-slate-200">
    <CardContent className="space-y-0.5 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="text-xl leading-tight font-semibold text-slate-950">{value}</p>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </CardContent>
  </Card>
);

const LoanDeductionsTable = ({
  onDeleteManualRow,
  rows,
}: {
  onDeleteManualRow: (row: EmployeeLoanDeduction) => void;
  rows: EmployeeLoanDeduction[];
}) => {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        No deductions have been recorded for this loan yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200 text-left text-slate-600">
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Scheduled</th>
            <th className="px-4 py-3 font-medium">Deducted</th>
            <th className="px-4 py-3 font-medium">Remaining</th>
            <th className="px-4 py-3 font-medium">Payroll run</th>
            <th className="px-4 py-3 font-medium">Receipt</th>
            <th className="px-4 py-3 font-medium">Notes</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 align-top">
              <td className="px-4 py-3">{formatDateLabel(row.deduction_date)}</td>
              <td className="px-4 py-3">{money(row.scheduled_amount)}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{money(row.deducted_amount)}</td>
              <td className="px-4 py-3">{money(row.remaining_balance_after)}</td>
              <td className="px-4 py-3">{row.payroll_run_id ?? 'Manual / N/A'}</td>
              <td className="px-4 py-3">{row.receipt_number ?? '—'}</td>
              <td className="px-4 py-3 text-slate-500">{row.notes ?? '—'}</td>
              <td className="px-4 py-3">
                {row.payroll_run_id == null ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteManualRow(row)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400">Locked</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ProjectedDeductionsTable = ({ rows }: { rows: ProjectedDeduction[] }) => {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        There are no pending deductions to project.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200 text-left text-slate-600">
            <th className="px-4 py-3 font-medium">Installment</th>
            <th className="px-4 py-3 font-medium">Projected date</th>
            <th className="px-4 py-3 font-medium">Planned amount</th>
            <th className="px-4 py-3 font-medium">Balance after</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.step}-${row.deductionDate}`} className="border-b border-slate-100">
              <td className="px-4 py-3">{row.step}</td>
              <td className="px-4 py-3">{formatDateLabel(row.deductionDate)}</td>
              <td className="px-4 py-3">{money(row.amount)}</td>
              <td className="px-4 py-3">{money(row.remainingAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

type ManualPaymentFormState = {
  amount: string;
  date: string;
  notes: string;
};

const createManualPaymentDefaults = (): ManualPaymentFormState => ({
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
});

export const LoansShow = () => (
  <Show title={false} actions={false} className="hidden">
    <LoansShowContent />
  </Show>
);

const LoansShowContent = () => {
  const record = useRecordContext<EmployeeLoan>();
  const config = useConfigurationContext();
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [searchParams, setSearchParams] = useSearchParams();
  const [update] = useUpdate<EmployeeLoan>();
  const [createDeduction] = useCreate<EmployeeLoanDeduction>();
  const [deleteDeduction, { isPending: isDeletingDeduction }] = useDelete();
  const [isManualPaymentOpen, setIsManualPaymentOpen] = useState(false);
  const [isCancelLoanOpen, setIsCancelLoanOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'manual' | 'payroll'>('all');
  const [isSubmittingManualPayment, setIsSubmittingManualPayment] = useState(false);
  const [deductionToDelete, setDeductionToDelete] = useState<EmployeeLoanDeduction | null>(null);
  const [manualPaymentForm, setManualPaymentForm] = useState<ManualPaymentFormState>(
    createManualPaymentDefaults(),
  );

  const { data: employee } = useGetOne<Person>(
    'people',
    { id: record?.employee_id ?? '' },
    { enabled: record?.employee_id != null },
  );

  const { data: deductions = [] } = useGetList<EmployeeLoanDeduction>(
    'employee_loan_deductions',
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: 'deduction_date', order: 'ASC' },
      filter: { loan_id: record?.id },
    },
    { enabled: Boolean(record?.id) },
  );

  useEffect(() => {
    if (!record || searchParams.get('print') !== '1') return;
    const timer = window.setTimeout(() => {
      window.print();
      const next = new URLSearchParams(searchParams);
      next.delete('print');
      setSearchParams(next, { replace: true });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [record, searchParams, setSearchParams]);

  if (!record) return null;

  const status = getLoanStatus(record);
  const employeeName = employee
    ? `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim()
    : `Employee #${record.employee_id}`;
  const paySchedule = getCompanyPaySchedule(config.payrollSettings);
  const projectedDeductions = buildProjectedDeductions({
    deductions,
    loan: record,
    schedule: paySchedule,
  });
  const totalPaid = roundMoney(
    Math.max(0, Number(record.original_amount ?? 0) - Number(record.remaining_balance ?? 0)),
  );
  const progress = Math.min(
    100,
    Math.max(0, (totalPaid / Math.max(Number(record.original_amount ?? 0), 0.01)) * 100),
  );
  const nextProjectedDeduction = projectedDeductions[0];
  const completedDeductions = deductions.length;
  const filteredDeductions = deductions.filter((row) => {
    if (historyFilter === 'manual') return row.payroll_run_id == null;
    if (historyFilter === 'payroll') return row.payroll_run_id != null;
    return true;
  });
  const plannedDeductionCount =
    Number(record.payment_count ?? 0) > 0
      ? Number(record.payment_count)
      : completedDeductions + projectedDeductions.length;
  const companyName = config.companyLegalName?.trim() || config.title;
  const companyAddress = joinParts(
    config.companyAddressLine1,
    config.companyAddressLine2,
    joinParts(config.companyCity, config.companyState, config.companyPostalCode),
    config.companyCountry,
  );
  const employeeContact = joinParts(employee?.phone, employee?.email);
  const employeeRole = employee?.specialty?.trim() || employee?.type || 'Employee';
  const employeeShowPath =
    employee?.id != null
      ? createPath({ resource: 'people', id: employee.id, type: 'show' })
      : null;

  const handlePrint = () => {
    const next = new URLSearchParams(searchParams);
    next.set('print', '1');
    setSearchParams(next, { replace: true });
  };

  const handleTogglePause = async () => {
    if (status === 'completed' || status === 'cancelled') return;

    const nextPaused = !record.paused;
    try {
      await update(
        'employee_loans',
        {
          id: record.id,
          data: {
            paused: nextPaused,
            active: true,
            status: nextPaused ? 'paused' : 'active',
          },
          previousData: record,
        },
        { returnPromise: true },
      );
      notify(nextPaused ? 'Loan paused.' : 'Loan resumed.', { type: 'info' });
      refresh();
    } catch {
      notify('Unable to update the loan status.', { type: 'error' });
    }
  };

  const handleManualPaymentSubmit = async () => {
    const enteredAmount = Number(manualPaymentForm.amount);
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      notify('Enter a valid manual payment amount.', { type: 'warning' });
      return;
    }

    if (!manualPaymentForm.date) {
      notify('Select the deduction date.', { type: 'warning' });
      return;
    }

    const appliedAmount = roundMoney(
      Math.min(enteredAmount, Number(record.remaining_balance ?? 0)),
    );
    const newBalance = roundMoney(
      Math.max(0, Number(record.remaining_balance ?? 0) - appliedAmount),
    );
    const nextStatus =
      newBalance <= 0 ? 'completed' : record.paused ? 'paused' : status === 'cancelled' ? 'cancelled' : 'active';

    setIsSubmittingManualPayment(true);
    try {
      await createDeduction(
        'employee_loan_deductions',
        {
          data: {
            loan_id: record.id,
            deduction_date: manualPaymentForm.date,
            scheduled_amount: appliedAmount,
            deducted_amount: appliedAmount,
            remaining_balance_after: newBalance,
            receipt_number: buildReceiptNumber('DEDUCT', manualPaymentForm.date),
            receipt_generated_at: new Date().toISOString(),
            notes: manualPaymentForm.notes.trim() || 'Manual payment',
          },
        },
        { returnPromise: true },
      );

      await update(
        'employee_loans',
        {
          id: record.id,
          data: {
            remaining_balance: newBalance,
            active: newBalance > 0,
            paused: newBalance <= 0 ? false : record.paused,
            status: nextStatus,
          },
          previousData: record,
        },
        { returnPromise: true },
      );

      notify('Manual payment recorded.', { type: 'success' });
      setManualPaymentForm(createManualPaymentDefaults());
      setIsManualPaymentOpen(false);
      refresh();
    } catch {
      notify('Unable to record the manual payment.', { type: 'error' });
    } finally {
      setIsSubmittingManualPayment(false);
    }
  };

  const handleDeleteManualDeduction = async () => {
    if (!deductionToDelete) return;

    const restoredBalance = roundMoney(
      Number(record.remaining_balance ?? 0) + Number(deductionToDelete.deducted_amount ?? 0),
    );
    const nextLoanStatus = record.paused ? 'paused' : 'active';

    try {
      await deleteDeduction(
        'employee_loan_deductions',
        { id: deductionToDelete.id, previousData: deductionToDelete },
        { returnPromise: true },
      );
      await update(
        'employee_loans',
        {
          id: record.id,
          data: {
            remaining_balance: restoredBalance,
            active: true,
            paused: record.paused,
            status: nextLoanStatus,
          },
          previousData: record,
        },
        { returnPromise: true },
      );
      notify('Manual deduction deleted and balance restored.', { type: 'success' });
      setDeductionToDelete(null);
      refresh();
    } catch {
      notify('Unable to delete the manual deduction.', { type: 'error' });
    }
  };

  const handleCancelLoan = async () => {
    try {
      await update(
        'employee_loans',
        {
          id: record.id,
          data: {
            active: false,
            paused: false,
            status: 'cancelled',
          },
          previousData: record,
        },
        { returnPromise: true },
      );
      notify('Loan cancelled.', { type: 'info' });
      setIsCancelLoanOpen(false);
      refresh();
    } catch {
      notify('Unable to cancel the loan.', { type: 'error' });
    }
  };

  return (
    <>
      <div className="print:hidden space-y-4">
        <Card className="overflow-hidden border-0 shadow-none">
          <CardContent className="space-y-2 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1.5">
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="-ml-3 h-8 px-2"
                    onClick={() => navigate('/employee_loans')}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Regresar
                  </Button>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                  {employeeName}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{getLoanRecordTypeLabel(record.record_type)}</Badge>
                  <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
                  <Badge variant="outline">{record.disbursement_receipt_number ?? 'No receipt'}</Badge>
                </div>
                <p className="max-w-3xl text-sm text-slate-500">
                  {getRepaymentSummary(record)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {employeeShowPath ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(employeeShowPath)}
                  >
                    View employee
                  </Button>
                ) : null}
                <EditButton label="Edit" />
                <Button type="button" variant="outline" onClick={handleTogglePause}>
                  {record.paused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                  {record.paused ? 'Resume' : 'Pause'}
                </Button>
                <Button type="button" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Repayment progress</p>
              <p className="text-sm text-slate-500">
                {plannedDeductionCount > 0
                  ? `${completedDeductions} of ${plannedDeductionCount} planned deductions posted`
                  : `${completedDeductions} deductions posted`}
              </p>
            </div>
            <p className="text-sm font-medium text-slate-700">{progress.toFixed(0)}%</p>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="inline-flex h-10 w-full justify-start gap-1 overflow-x-auto rounded-lg border bg-muted/50 px-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-0">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <LoanMetricCard
                label="Amount delivered"
                value={money(record.original_amount)}
                hint={`Issued ${formatDateLabel(record.loan_date)}`}
              />
              <LoanMetricCard
                label="Paid so far"
                value={money(totalPaid)}
                hint={`${completedDeductions} deduction${completedDeductions === 1 ? '' : 's'} posted`}
              />
              <LoanMetricCard
                label="Current balance"
                value={money(record.remaining_balance)}
                hint={`Installment ${money(record.fixed_installment_amount)}`}
              />
              <LoanMetricCard
                label="Next deduction"
                value={
                  nextProjectedDeduction
                    ? formatDateLabel(nextProjectedDeduction.deductionDate)
                    : 'No pending deductions'
                }
                hint={
                  nextProjectedDeduction
                    ? money(nextProjectedDeduction.amount)
                    : status === 'completed'
                      ? 'Loan completed'
                      : 'No schedule available'
                }
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>Loan profile</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 text-sm">
                    <p><span className="font-medium text-slate-500">Employee</span><br />{employeeName}</p>
                    <p><span className="font-medium text-slate-500">Role</span><br />{employeeRole}</p>
                    <p><span className="font-medium text-slate-500">Contact</span><br />{employeeContact || 'Not provided'}</p>
                    <p><span className="font-medium text-slate-500">Identification</span><br />{employee?.identification_number?.trim() || 'Not provided'}</p>
                  </div>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-medium text-slate-500">Loan date</span><br />{formatDateLabel(record.loan_date)}</p>
                    <p><span className="font-medium text-slate-500">First deduction</span><br />{record.first_deduction_date ? formatDateLabel(record.first_deduction_date) : 'Next payroll'}</p>
                    <p><span className="font-medium text-slate-500">Repayment mode</span><br />{getPayScheduleLabel(record.repayment_schedule)}</p>
                    <p><span className="font-medium text-slate-500">Receipt</span><br />{record.disbursement_receipt_number ?? '—'}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>Notes and authorization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-600">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Company
                    </p>
                    <p className="font-medium text-slate-900">{companyName}</p>
                    {companyAddress ? <p>{companyAddress}</p> : null}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Notes
                    </p>
                    <p>{record.notes?.trim() || 'No notes recorded for this loan.'}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Terms
                    </p>
                    <p>
                      {record.reason?.trim() ||
                        'Payroll deductions continue according to schedule until the balance reaches zero or the loan is manually closed.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Projected deduction schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Payroll cadence
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{paySchedule}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Planned deductions
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {plannedDeductionCount || projectedDeductions.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Pending installments
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {projectedDeductions.length}
                    </p>
                  </div>
                </div>
                <ProjectedDeductionsTable rows={projectedDeductions} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Deduction history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={historyFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setHistoryFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant={historyFilter === 'payroll' ? 'default' : 'outline'}
                    onClick={() => setHistoryFilter('payroll')}
                  >
                    Payroll
                  </Button>
                  <Button
                    type="button"
                    variant={historyFilter === 'manual' ? 'default' : 'outline'}
                    onClick={() => setHistoryFilter('manual')}
                  >
                    Manual
                  </Button>
                </div>
                <LoanDeductionsTable
                  rows={filteredDeductions}
                  onDeleteManualRow={(row) => setDeductionToDelete(row)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="border-slate-200 xl:col-span-2">
                <CardHeader>
                  <CardTitle>Quick actions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <Button type="button" variant="outline" className="justify-start" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print loan detail
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start"
                    onClick={() =>
                      navigate(createPath({ resource: 'employee_loans', id: record.id, type: 'edit' }))
                    }
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit loan
                  </Button>
                  <Button type="button" variant="outline" className="justify-start" onClick={handleTogglePause}>
                    {record.paused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                    {record.paused ? 'Resume deductions' : 'Pause deductions'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      setManualPaymentForm(createManualPaymentDefaults());
                      setIsManualPaymentOpen(true);
                    }}
                    disabled={status === 'completed' || status === 'cancelled'}
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Register manual payment
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start"
                    onClick={() => setIsCancelLoanOpen(true)}
                    disabled={status === 'completed' || status === 'cancelled'}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel loan
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>Operational status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-600">
                  <p>
                    <span className="font-medium text-slate-500">State</span>
                    <br />
                    {status}
                  </p>
                  <p>
                    <span className="font-medium text-slate-500">Last deduction</span>
                    <br />
                    {deductions.length
                      ? `${formatDateLabel(deductions[deductions.length - 1].deduction_date)} for ${money(deductions[deductions.length - 1].deducted_amount)}`
                      : 'No deductions posted yet'}
                  </p>
                  <p>
                    <span className="font-medium text-slate-500">Next expected deduction</span>
                    <br />
                    {nextProjectedDeduction
                      ? `${formatDateLabel(nextProjectedDeduction.deductionDate)} for ${money(nextProjectedDeduction.amount)}`
                      : 'No pending deductions'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isManualPaymentOpen} onOpenChange={setIsManualPaymentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register manual payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">{employeeName}</p>
              <p>Current balance: {money(record.remaining_balance)}</p>
              <p>Regular installment: {money(record.fixed_installment_amount)}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="manual-payment-amount">
                Amount
              </label>
              <Input
                id="manual-payment-amount"
                type="number"
                min="0"
                step="0.01"
                value={manualPaymentForm.amount}
                onChange={(event) =>
                  setManualPaymentForm((current) => ({ ...current, amount: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="manual-payment-date">
                Deduction date
              </label>
              <Input
                id="manual-payment-date"
                type="date"
                value={manualPaymentForm.date}
                onChange={(event) =>
                  setManualPaymentForm((current) => ({ ...current, date: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="manual-payment-notes">
                Notes
              </label>
              <Textarea
                id="manual-payment-notes"
                rows={4}
                value={manualPaymentForm.notes}
                onChange={(event) =>
                  setManualPaymentForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional explanation for this manual payment"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsManualPaymentOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleManualPaymentSubmit()}
                disabled={isSubmittingManualPayment}
              >
                {isSubmittingManualPayment ? 'Saving...' : 'Save payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Confirm
        isOpen={Boolean(deductionToDelete)}
        title="Delete manual deduction?"
        content="This will remove the manual deduction entry and restore its amount to the loan balance."
        confirm="Delete deduction"
        confirmColor="warning"
        loading={isDeletingDeduction}
        onClose={() => setDeductionToDelete(null)}
        onConfirm={() => void handleDeleteManualDeduction()}
      />

      <Confirm
        isOpen={isCancelLoanOpen}
        title="Cancel this loan?"
        content="This will stop future deductions and mark the loan as cancelled."
        confirm="Cancel loan"
        confirmColor="warning"
        onClose={() => setIsCancelLoanOpen(false)}
        onConfirm={() => void handleCancelLoan()}
      />

      <LoanPrintReceipt deductions={deductions} employee={employee} />
    </>
  );
};

const LoanPrintReceipt = ({
  deductions,
  employee,
}: {
  deductions: EmployeeLoanDeduction[];
  employee?: Person;
}) => {
  const record = useRecordContext<EmployeeLoan>();
  const config = useConfigurationContext();

  if (!record) return null;

  const employeeName = employee
    ? `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim()
    : `Employee #${record.employee_id}`;
  const companyName = config.companyLegalName?.trim() || config.title;
  const companyAddress = joinParts(
    config.companyAddressLine1,
    config.companyAddressLine2,
    joinParts(config.companyCity, config.companyState, config.companyPostalCode),
    config.companyCountry,
  );
  const employeeContact = joinParts(employee?.phone, employee?.email);
  const employeeRole = employee?.specialty?.trim() || employee?.type || 'Employee';
  const representativeName =
    config.companyRepresentativeName?.trim() || '______________________________';
  const representativeTitle =
    config.companyRepresentativeTitle?.trim() || 'Authorized Representative';
  const companyPaySchedule = getCompanyPaySchedule(config.payrollSettings);
  const amortizationRows = buildAmortizationSchedule({
    loan: record,
    schedule: companyPaySchedule,
  });

  return (
    <div className="loan-print-only hidden print:block">
      <div className="loan-print-page mx-auto w-full max-w-none bg-white px-4 py-4 text-black">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Payroll Finance Document
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{companyName}</h1>
            <p className="mt-1 text-sm text-slate-700">
              {record.record_type === 'advance'
                ? 'Employee Advance Receipt'
                : 'Employee Loan Agreement Receipt'}
            </p>
            <div className="mt-2 space-y-1 text-sm text-slate-600">
              {companyAddress ? <p>{companyAddress}</p> : null}
              {config.companyPhone ? <p>Phone: {config.companyPhone}</p> : null}
              {config.companyEmail ? <p>Email: {config.companyEmail}</p> : null}
              {config.companyTaxId ? <p>Tax ID / EIN: {config.companyTaxId}</p> : null}
            </div>
          </div>
          <div className="min-w-[220px] px-3 py-2 text-right text-sm">
            <p><span className="font-semibold">Receipt No.:</span> {record.disbursement_receipt_number ?? '—'}</p>
            <p><span className="font-semibold">Issue date:</span> {record.loan_date}</p>
            <p><span className="font-semibold">Status:</span> {getLoanStatus(record)}</p>
          </div>
        </div>

        <div className="mb-3 p-2">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <p><span className="font-semibold">Employee:</span> {employeeName}</p>
            <p><span className="font-semibold">Record type:</span> {getLoanRecordTypeLabel(record.record_type)}</p>
            <p><span className="font-semibold">Amount delivered:</span> {money(record.original_amount)}</p>
            <p><span className="font-semibold">Current balance:</span> {money(record.remaining_balance)}</p>
            <p><span className="font-semibold">Deduct each payroll:</span> {money(record.fixed_installment_amount)}</p>
            <p><span className="font-semibold">Plan:</span> {getRepaymentSummary(record)}</p>
            <p><span className="font-semibold">First deduction:</span> {record.first_deduction_date ?? 'Next payroll'}</p>
            <p><span className="font-semibold">Planned deductions:</span> {record.payment_count ?? (record.record_type === 'advance' ? 1 : '—')}</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <p><span className="font-semibold">Identification No.:</span> {employee?.identification_number?.trim() || 'Not provided'}</p>
            <p><span className="font-semibold">Phone / Email:</span> {employeeContact || 'Not provided'}</p>
            <p><span className="font-semibold">Department / Role:</span> {employeeRole}</p>
            <p><span className="font-semibold">Approved by:</span> {representativeName}</p>
          </div>
        </div>

        <div className="mb-3 p-2 text-sm">
          <p className="font-semibold uppercase tracking-wide text-slate-700">Loan amortization</p>
          {amortizationRows.length ? (
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="text-slate-600">
                  <th className="py-1">#</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Installment</th>
                  <th className="py-2">Balance after</th>
                </tr>
              </thead>
              <tbody>
                {amortizationRows.map((row) => (
                  <tr key={row.step}>
                    <td className="py-1">{row.step}</td>
                    <td className="py-1">{formatDateLabel(row.deductionDate)}</td>
                    <td className="py-1">{money(row.installment)}</td>
                    <td className="py-1">{money(row.remainingAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-slate-700">No amortization rows available.</p>
          )}
          <p className="mt-2 text-xs text-slate-500">Recorded deductions: {deductions.length}</p>
        </div>

        <div className="mb-4 p-2 text-sm">
          <p className="mb-2 font-semibold uppercase tracking-wide text-slate-700">Notes / Terms</p>
          <p className="mb-2 text-slate-700">{record.reason || 'No specific terms provided.'}</p>
          <p className="mt-2 text-slate-700">
            {record.notes ||
              (record.record_type === 'advance'
                ? 'This advance will be deducted according to the payroll plan selected above.'
                : 'This loan will be deducted from future payrolls until the balance reaches zero and the record is completed automatically.')}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="border-t border-slate-500 pt-2">
              <p className="font-semibold">Employee Signature</p>
              <p>{employeeName}</p>
              <p className="mt-6 text-slate-500">Date: ____________________</p>
            </div>
          </div>
          <div>
            <div className="border-t border-slate-500 pt-2">
              <p className="font-semibold">Company Representative Signature</p>
              <p className="text-slate-600">Authorized Representative</p>
              <p className="mt-6 text-slate-500">Date: ____________________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
