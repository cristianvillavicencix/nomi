import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ResponsiveBar } from "@nivo/bar";
import { useMemo } from "react";
import { useGetList } from "ra-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProposalPaymentInstallment } from "@/lbs/types";

const monthsBack = 6;

export const BillingRevenueChart = () => {
  const since = useMemo(
    () => subMonths(startOfMonth(new Date()), monthsBack - 1).toISOString(),
    [],
  );

  const { data: installments = [], isPending } =
    useGetList<ProposalPaymentInstallment>("proposal_payment_installments", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "paid_at", order: "ASC" },
      filter: {
        "status@eq": "paid",
        "paid_at@gte": since,
      },
    });

  const chartData = useMemo(() => {
    const buckets = new Map<string, { collected: number; count: number }>();

    for (let i = 0; i < monthsBack; i += 1) {
      const monthStart = startOfMonth(subMonths(new Date(), monthsBack - 1 - i));
      const key = format(monthStart, "yyyy-MM");
      buckets.set(key, { collected: 0, count: 0 });
    }

    for (const row of installments) {
      if (!row.paid_at) continue;
      const key = format(startOfMonth(parseISO(row.paid_at)), "yyyy-MM");
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.collected += Number(row.amount) || 0;
      bucket.count += 1;
    }

    return [...buckets.entries()].map(([monthKey, values]) => ({
      month: format(parseISO(`${monthKey}-01`), "MMM yy"),
      collected: Math.round(values.collected * 100) / 100,
      payments: values.count,
    }));
  }, [installments]);

  const totalCollected = chartData.reduce((sum, row) => sum + row.collected, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Revenue (last {monthsBack} months)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Collected from paid installments — ${totalCollected.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} total
        </p>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading chart…</p>
        ) : chartData.every((row) => row.collected === 0) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No collected payments in this period yet.
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveBar
              data={chartData}
              keys={["collected"]}
              indexBy="month"
              margin={{ top: 8, right: 8, bottom: 40, left: 56 }}
              padding={0.35}
              colors={["hsl(var(--primary))"]}
              axisBottom={{ tickSize: 0, tickPadding: 8 }}
              axisLeft={{
                tickSize: 0,
                tickPadding: 8,
                format: (v) =>
                  `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
              }}
              enableLabel={false}
              tooltip={({ indexValue, value }) => (
                <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow-md">
                  <strong>{indexValue}</strong>: ${Number(value).toLocaleString("en-US")}
                </div>
              )}
              theme={{
                text: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
                grid: { line: { stroke: "hsl(var(--border))" } },
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
