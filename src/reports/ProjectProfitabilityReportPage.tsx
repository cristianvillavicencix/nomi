import { useMemo, useState } from 'react';
import { useGetList } from 'ra-core';
import { ResponsiveBar } from '@nivo/bar';
import { Card, CardContent } from '@/components/ui/card';
import { ReportDateFilters } from './ReportFilters';

export const ProjectProfitabilityReportPage = ({
  embedded = false,
}: {
  embedded?: boolean;
}) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filter = useMemo(
    () => ({
      ...(from ? { 'metric_date@gte': from } : {}),
      ...(to ? { 'metric_date@lte': to } : {}),
    }),
    [from, to],
  );

  const { data, isPending } = useGetList('report_project_profitability', {
    pagination: { page: 1, perPage: 100 },
    sort: { field: 'profit', order: 'DESC' },
    filter,
  });

  const chartData =
    data?.slice(0, 8).map((item: any) => ({
      project: item.project_name,
      profit: Number(item.profit ?? 0),
    })) ?? [];

  return (
    <div className="space-y-4">
      {!embedded ? (
        <h1 className="text-2xl font-semibold">Project Profitability</h1>
      ) : null}
      <ReportDateFilters from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      <Card>
        <CardContent className="pt-6">
          {isPending ? null : (
            <div className="h-[320px]">
              <ResponsiveBar
                data={chartData}
                keys={['profit']}
                indexBy="project"
                margin={{ top: 20, right: 20, bottom: 80, left: 80 }}
                padding={0.3}
                axisBottom={{ tickRotation: -25 }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Project</th>
                <th className="py-2">Hours</th>
                <th className="py-2">Labor Cost</th>
                <th className="py-2">Revenue</th>
                <th className="py-2">Profit</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((row: any) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{row.project_name}</td>
                  <td className="py-2">{row.total_hours}</td>
                  <td className="py-2">${Number(row.total_labor_cost ?? 0).toFixed(2)}</td>
                  <td className="py-2">${Number(row.total_revenue ?? 0).toFixed(2)}</td>
                  <td className="py-2">${Number(row.profit ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
