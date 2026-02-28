import { useMemo, useState } from 'react';
import { useGetList } from 'ra-core';
import { Card, CardContent } from '@/components/ui/card';
import { ReportDateFilters } from './ReportFilters';

export const SalesCommissionsReportPage = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filter = useMemo(
    () => ({
      ...(from ? { 'pay_date@gte': from } : {}),
      ...(to ? { 'pay_date@lte': to } : {}),
    }),
    [from, to],
  );

  const { data } = useGetList('report_sales_commissions_by_salesperson', {
    pagination: { page: 1, perPage: 200 },
    sort: { field: 'pay_date', order: 'DESC' },
    filter,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sales Commissions by Salesperson</h1>
      <ReportDateFilters from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Salesperson</th>
                <th className="py-2">Pay Date</th>
                <th className="py-2">Commission Lines</th>
                <th className="py-2">Total Commission</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((row: any) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{row.salesperson_name}</td>
                  <td className="py-2">{row.pay_date}</td>
                  <td className="py-2">{row.commission_lines}</td>
                  <td className="py-2">${Number(row.total_commission ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
