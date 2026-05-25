import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetOne } from "ra-core";
import { Link, useParams } from "react-router";
import { ResponsiveBar } from "@nivo/bar";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchFormAnalytics } from "@/lbs/forms-v2/analytics/formAnalyticsQueries";
import type { FormInstance } from "@/lbs/forms-v2/types";

const MetricCard = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <Card>
    <CardContent className="pt-6">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </CardContent>
  </Card>
);

export const FormAnalyticsPage = () => {
  const { id = "" } = useParams();

  const { data: form, isPending: formPending } = useGetOne<FormInstance>(
    "form_instances",
    { id },
    { enabled: Boolean(id) },
  );

  const { data: metrics, isPending: metricsPending } = useQuery({
    queryKey: ["form-analytics", id],
    enabled: Boolean(id),
    queryFn: () => fetchFormAnalytics(Number(id)),
  });

  const submissionsChart = useMemo(
    () =>
      (metrics?.submissionsByDay ?? []).map((row) => ({
        date: new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        submissions: row.count,
      })),
    [metrics?.submissionsByDay],
  );

  const fieldChart = useMemo(
    () =>
      (metrics?.fieldCompletion ?? []).slice(0, 12).map((row) => ({
        field: row.field_key,
        rate: row.completion_rate ?? 0,
      })),
    [metrics?.fieldCompletion],
  );

  if (formPending || !form) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-muted-foreground">Loading analytics…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2"
            asChild
          >
            <Link to="/forms-v2">
              <ArrowLeft className="mr-2 size-4" />
              Back to forms
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <BarChart3 className="size-6" />
            {form.name} analytics
          </h1>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to={`/forms-v2/submissions?form=${form.id}`}>
            View submissions
          </Link>
        </Button>
      </div>

      {metricsPending || !metrics ? (
        <p className="text-sm text-muted-foreground">Loading metrics…</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Views" value={metrics.views} />
            <MetricCard label="Starts" value={metrics.starts} />
            <MetricCard label="Submissions" value={metrics.submissions} />
            <MetricCard
              label="Completion rate"
              value={
                metrics.completionRate != null
                  ? `${metrics.completionRate}%`
                  : "—"
              }
            />
            <MetricCard label="Spam blocked" value={metrics.spamBlocked} />
            <MetricCard label="Rate limited" value={metrics.rateLimited} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-4 text-sm font-semibold">
                  Submissions (last 30 days)
                </h2>
                <div className="h-64">
                  {submissionsChart.length > 0 ? (
                    <ResponsiveBar
                      data={submissionsChart}
                      keys={["submissions"]}
                      indexBy="date"
                      margin={{ top: 8, right: 16, bottom: 40, left: 40 }}
                      padding={0.3}
                      colors={{ scheme: "category10" }}
                      axisBottom={{ tickRotation: -35 }}
                      enableLabel={false}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No submissions in the last 30 days.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-4 text-sm font-semibold">
                  Field completion rate
                </h2>
                <div className="h-64">
                  {fieldChart.length > 0 ? (
                    <ResponsiveBar
                      data={fieldChart}
                      keys={["rate"]}
                      indexBy="field"
                      layout="horizontal"
                      margin={{ top: 8, right: 16, bottom: 40, left: 120 }}
                      padding={0.3}
                      colors={{ scheme: "paired" }}
                      axisLeft={{ tickRotation: 0 }}
                      enableLabel={false}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No field completion events yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 text-sm font-semibold">Top sources</h2>
              {metrics.sources.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No source data recorded yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Submissions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.sources.map((row) => (
                      <TableRow key={row.source}>
                        <TableCell>{row.source}</TableCell>
                        <TableCell className="text-right">
                          {row.count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
