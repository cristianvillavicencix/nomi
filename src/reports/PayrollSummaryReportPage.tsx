import { useMemo, useState } from 'react';
import { useGetList } from 'ra-core';
import { Card, CardContent } from '@/components/ui/card';
import { ReportDateFilters } from './ReportFilters';

export const PayrollSummaryReportPage = ({
  embedded = false,
}: {
  embedded?: boolean;
}) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filter = useMemo(
    () => ({
      ...(from ? { 'pay_date@gte': from } : {}),
      ...(to ? { 'pay_date@lte': to } : {}),
    }),
    [from, to],
  );

  const { data } = useGetList('report_payroll_summary', {
    pagination: { page: 1, perPage: 100 },
    sort: { field: 'pay_date', order: 'DESC' },
    filter,
  });

  return (
    <div className="space-y-4">
      {!embedded ? (
        <h1 className="text-2xl font-semibold">Payroll Summary by Period</h1>
      ) : null}
      <ReportDateFilters from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Period</th>
                <th className="py-2">Pay Date</th>
                <th className="py-2">Status</th>
                <th className="py-2">Lines</th>
                <th className="py-2">Gross</th>
                <th className="py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((row: any) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{row.pay_period_start} - {row.pay_period_end}</td>
                  <td className="py-2">{row.pay_date}</td>
                  <td className="py-2">{row.status}</td>
                  <td className="py-2">{row.lines_count}</td>
                  <td className="py-2">${Number(row.total_gross ?? 0).toFixed(2)}</td>
                  <td className="py-2">${Number(row.total_net ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
