import { useMemo } from 'react';
import { useGetMany, useListContext } from 'ra-core';
import type { PayrollRunLine, Person } from '@/components/atomic-crm/types';

const money = (value?: number | null) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));

type PayrollRunLinesTableContentProps = {
  lines: PayrollRunLine[];
  isPending?: boolean;
};

const PayrollRunLinesTableContent = ({
  lines,
  isPending = false,
}: PayrollRunLinesTableContentProps) => {
  const data = lines;

  const employeeIds = useMemo(
    () => Array.from(new Set(data.map((line) => line.employee_id).filter((id) => id != null))),
    [data],
  );

  const { data: employees = [] } = useGetMany<Person>(
    'people',
    { ids: employeeIds },
    { enabled: employeeIds.length > 0 },
  );

  const employeesById = useMemo(
    () => Object.fromEntries(employees.map((employee) => [String(employee.id), employee])),
    [employees],
  );

  if (isPending) return null;
  if (!data.length) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        No payroll lines yet. Generate the run first.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="border-b text-left">
            <th className="px-3 py-2">Employee</th>
            <th className="px-3 py-2">Compensation</th>
            <th className="px-3 py-2">Method</th>
            <th className="px-3 py-2">Work breakdown</th>
            <th className="px-3 py-2">Gross breakdown</th>
            <th className="px-3 py-2">Deduction breakdown</th>
            <th className="px-3 py-2">Gross</th>
            <th className="px-3 py-2">Deductions</th>
            <th className="px-3 py-2">Net</th>
            <th className="px-3 py-2">Reference</th>
          </tr>
        </thead>
        <tbody>
          {data.map((line) => {
            const employee = employeesById[String(line.employee_id)];
            const employeeName = employee
              ? `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim()
              : `#${line.employee_id}`;
            const workBreakdown = [
              Number(line.regular_hours ?? 0) > 0 ? `Reg ${Number(line.regular_hours ?? 0)}h` : null,
              Number(line.overtime_hours ?? 0) > 0 ? `OT ${Number(line.overtime_hours ?? 0)}h` : null,
              Number(line.paid_leave_hours ?? 0) > 0 ? `Leave ${Number(line.paid_leave_hours ?? 0)}h` : null,
            ].filter(Boolean);
            const grossBreakdown = [
              Number(line.base_salary_amount ?? line.compensation_amount ?? 0) > 0
                ? `Base ${money(line.base_salary_amount ?? line.compensation_amount)}`
                : null,
            ].filter(Boolean);
            const deductionBreakdown = [
              Number(line.unpaid_absence_deduction ?? 0) > 0 ? `Absence ${money(line.unpaid_absence_deduction)}` : null,
              Number(line.loan_deductions ?? 0) > 0 ? `Loan ${money(line.loan_deductions)}` : null,
              Number(line.other_deductions ?? 0) > 0 ? `Other ${money(line.other_deductions)}` : null,
            ].filter(Boolean);
            return (
              <tr key={line.id} className="border-b">
                <td className="px-3 py-2">{employeeName}</td>
                <td className="px-3 py-2">{line.compensation_unit ?? line.compensation_type}</td>
                <td className="px-3 py-2">{line.payment_method}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {workBreakdown.length ? workBreakdown.join(' · ') : 'No hours breakdown'}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {grossBreakdown.length ? grossBreakdown.join(' · ') : 'Calculated from rate'}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {deductionBreakdown.length ? deductionBreakdown.join(' · ') : 'No deductions'}
                </td>
                <td className="px-3 py-2 font-medium">{money(line.gross_pay)}</td>
                <td className="px-3 py-2">{money(line.total_deductions)}</td>
                <td className="px-3 py-2 font-semibold">{money(line.net_pay)}</td>
                <td className="px-3 py-2">{line.payment_reference ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const PayrollRunLinesTable = () => {
  const { data = [], isPending } = useListContext<PayrollRunLine>();

  return <PayrollRunLinesTableContent lines={data} isPending={isPending} />;
};

export const PayrollRunLinesTableForData = ({
  lines,
  isPending = false,
}: PayrollRunLinesTableContentProps) => (
  <PayrollRunLinesTableContent lines={lines} isPending={isPending} />
);
