import { useMemo, useState } from 'react';
import { useGetList } from 'ra-core';
import { Card, CardContent } from '@/components/ui/card';
import { ReportDateFilters } from './ReportFilters';

export const LaborCostByPersonReportPage = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filter = useMemo(
    () => ({
      ...(from ? { 'period_month@gte': from } : {}),
      ...(to ? { 'period_month@lte': to } : {}),
    }),
    [from, to],
  );

  const { data } = useGetList('report_labor_cost_by_person', {
    pagination: { page: 1, perPage: 200 },
    sort: { field: 'period_month', order: 'DESC' },
    filter,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Labor Cost by Person</h1>
      <ReportDateFilters from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Person</th>
                <th className="py-2">Month</th>
                <th className="py-2">Entries</th>
                <th className="py-2">Hours</th>
                <th className="py-2">Labor Cost</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((row: any) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{row.person_name}</td>
                  <td className="py-2">{row.period_month}</td>
                  <td className="py-2">{row.entries_count}</td>
                  <td className="py-2">{row.total_hours}</td>
                  <td className="py-2">${Number(row.total_labor_cost ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
