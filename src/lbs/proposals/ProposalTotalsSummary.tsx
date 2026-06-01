import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/admin/number-input";
import type { ProposalTotals } from "@/lbs/proposals/proposalCommercialUtils";
import { MoneyText } from "@/lib/permissions/MoneyText";

export const ProposalTotalsSummary = ({
  totals,
  depositPercent,
  validUntil,
}: {
  totals: ProposalTotals;
  depositPercent: number;
  validUntil: string;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">One-time total</span>
          <MoneyText value={totals.oneTimeTotal} className="font-medium" />
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">
            Deposit ({depositPercent}%)
          </span>
          <MoneyText value={totals.depositAmount} className="font-medium" />
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Balance</span>
          <MoneyText value={totals.balanceAmount} className="font-medium" />
        </div>
        <div className="space-y-1 border-t pt-3">
          <Label>Deposit %</Label>
          <NumberInput
            source="deposit_percent"
            label={false}
            min={0}
            max={100}
          />
        </div>
        {totals.recurringLines.length > 0 ? (
          <div className="space-y-2 border-t pt-3">
            <p className="font-medium">Recurring services</p>
            {totals.recurringLines.map((line) => (
              <div
                key={`${line.description}-${line.interval}`}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate text-muted-foreground">
                  {line.description}
                </span>
                <Badge variant="outline">
                  <MoneyText value={line.amount} /> / {line.interval}
                </Badge>
              </div>
            ))}
          </div>
        ) : null}
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Valid until {validUntil}
        </p>
      </CardContent>
    </Card>
  );
};
