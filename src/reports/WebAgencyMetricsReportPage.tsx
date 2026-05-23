import { useMemo } from "react";
import { useGetList } from "ra-core";
import { ResponsiveBar } from "@nivo/bar";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { useCanViewAmounts } from "@/lib/permissions/useMaskedAmount";

type WebAgencyMetricRow = {
  id?: string;
  org_id: number;
  month: string;
  won_count: number;
  lost_count: number;
  total_count: number;
  win_rate_percent: number | null;
  revenue_won: number | null;
};

export const WebAgencyMetricsReportPage = ({
  embedded = false,
}: {
  embedded?: boolean;
}) => {
  const canViewAmounts = useCanViewAmounts();
  const { data = [], isPending } = useGetList<WebAgencyMetricRow>(
    "report_web_agency_metrics",
    {
      pagination: { page: 1, perPage: 24 },
      sort: { field: "month", order: "DESC" },
    },
  );

  const chartData = useMemo(
    () =>
      [...data]
        .reverse()
        .slice(-12)
        .map((row) => ({
          month: new Date(`${row.month}T12:00:00`).toLocaleDateString(
            undefined,
            { month: "short", year: "2-digit" },
          ),
          won: Number(row.won_count ?? 0),
          lost: Number(row.lost_count ?? 0),
        })),
    [data],
  );

  const totals = useMemo(() => {
    const won = data.reduce((sum, row) => sum + Number(row.won_count ?? 0), 0);
    const lost = data.reduce(
      (sum, row) => sum + Number(row.lost_count ?? 0),
      0,
    );
    const revenue = data.reduce(
      (sum, row) => sum + Number(row.revenue_won ?? 0),
      0,
    );
    const winRate =
      won + lost > 0 ? Math.round((100 * won) / (won + lost)) : null;
    return { won, lost, revenue, winRate };
  }, [data]);

  return (
    <div className="space-y-4">
      {!embedded ? (
        <h1 className="text-2xl font-semibold">Web Agency Metrics</h1>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Win rate</div>
            <div className="text-2xl font-semibold">
              {totals.winRate != null ? `${totals.winRate}%` : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Closed won</div>
            <div className="text-2xl font-semibold">{totals.won}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Revenue won</div>
            <div className="text-2xl font-semibold">
              {canViewAmounts ? (
                <MoneyText value={totals.revenue} />
              ) : (
                "$ •••"
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isPending ? null : chartData.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No closed deals yet.
            </p>
          ) : (
            <div className="h-[320px] min-h-[200px]">
              <ResponsiveBar
                data={chartData}
                keys={["won", "lost"]}
                indexBy="month"
                margin={{ top: 20, right: 20, bottom: 50, left: 50 }}
                padding={0.3}
                groupMode="stacked"
                colors={["#16a34a", "#dc2626"]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Month</th>
                <th className="py-2">Won</th>
                <th className="py-2">Lost</th>
                <th className="py-2">Win rate</th>
                <th className="py-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.month} className="border-b">
                  <td className="py-2">
                    {new Date(`${row.month}T12:00:00`).toLocaleDateString(
                      undefined,
                      { month: "long", year: "numeric" },
                    )}
                  </td>
                  <td className="py-2">{row.won_count}</td>
                  <td className="py-2">{row.lost_count}</td>
                  <td className="py-2">
                    {row.win_rate_percent != null
                      ? `${row.win_rate_percent}%`
                      : "—"}
                  </td>
                  <td className="py-2">
                    {canViewAmounts ? (
                      <MoneyText value={Number(row.revenue_won ?? 0)} />
                    ) : (
                      "$ •••"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
