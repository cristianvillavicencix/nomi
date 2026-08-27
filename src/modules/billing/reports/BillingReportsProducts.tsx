import type { BillingReportsSnapshot } from "@/modules/billing/reports/billingReportsAggregation";
import { ReportSection } from "@/modules/billing/reports/ReportUi";
import { MoneyText } from "@/lib/permissions/MoneyText";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const BillingReportsProducts = ({
  snapshot,
  isPending,
}: {
  snapshot: BillingReportsSnapshot;
  isPending: boolean;
}) => {
  return (
    <ReportSection description="Top line items and plans billed through invoices and subscriptions.">
      <div className="overflow-hidden rounded-2xl bg-black/[0.025] dark:bg-white/[0.04]">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
              <TableHead>Item</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Records</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow className="border-border/40">
                <TableCell colSpan={5} className="text-muted-foreground">
                  Loading products…
                </TableCell>
              </TableRow>
            ) : snapshot.products.length === 0 ? (
              <TableRow className="border-border/40">
                <TableCell colSpan={5} className="text-muted-foreground">
                  No product or service lines found for this period.
                </TableCell>
              </TableRow>
            ) : (
              snapshot.products.map((row) => (
                <TableRow
                  key={`${row.name}-${row.source}`}
                  className="border-border/40"
                >
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {row.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MoneyText value={row.amount} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.count}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </ReportSection>
  );
};
