import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { NumberInput } from "@/components/admin/number-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { billingIntervalSuffix } from "@/lbs/catalog/catalogConstants";
import { newLineKey } from "@/lbs/proposals/proposalCatalogUtils";
import {
  generatePaymentInstallments,
  lineTotal,
  type PaymentScheduleConfig,
  type ProposalLineDraft,
  type ProposalTotals,
} from "@/lbs/proposals/proposalCommercialUtils";
import { ProposalPaymentSchedulePanel } from "@/lbs/proposals/ProposalPaymentSchedulePanel";
import { MoneyText } from "@/lib/permissions/MoneyText";

const CartLineRow = ({
  line,
  onChange,
  onRemove,
}: {
  line: ProposalLineDraft;
  onChange: (patch: Partial<ProposalLineDraft>) => void;
  onRemove: () => void;
}) => (
  <div className="space-y-2 rounded-lg border bg-card p-3">
    <div className="flex items-start justify-between gap-2">
      <Input
        value={line.description}
        onChange={(event) => onChange({ description: event.target.value })}
        className="font-medium"
        placeholder="Line description"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label="Remove line"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <div className="space-y-1">
        <Label className="text-xs">Qty</Label>
        <Input
          type="number"
          min={0}
          step={1}
          value={line.quantity}
          onChange={(event) =>
            onChange({ quantity: Number(event.target.value) || 0 })
          }
        />
      </div>
      <div className="space-y-1 col-span-2">
        <Label className="text-xs">Amount (editable)</Label>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={line.unit_price}
          onChange={(event) =>
            onChange({ unit_price: Number(event.target.value) || 0 })
          }
        />
      </div>
    </div>
    <div className="flex items-center justify-between text-sm">
      <Badge variant="outline" className="text-[10px]">
        {line.billing_type === "recurring"
          ? `Recurring${billingIntervalSuffix(line.billing_type, line.billing_interval)}`
          : "One-time"}
      </Badge>
      <span className="font-medium tabular-nums">
        <MoneyText value={lineTotal(line.quantity, line.unit_price)} />
        {billingIntervalSuffix(line.billing_type, line.billing_interval)}
      </span>
    </div>
  </div>
);

export const ProposalCartPanel = ({
  lines,
  onChange,
  totals,
  depositPercent,
  validUntil,
  scheduleConfig,
  onScheduleChange,
}: {
  lines: ProposalLineDraft[];
  onChange: (lines: ProposalLineDraft[]) => void;
  totals: ProposalTotals;
  depositPercent: number;
  validUntil: string;
  scheduleConfig: PaymentScheduleConfig;
  onScheduleChange: (config: PaymentScheduleConfig) => void;
}) => {
  const oneTimeLines = useMemo(
    () => lines.filter((line) => line.billing_type === "one_time"),
    [lines],
  );
  const recurringLines = useMemo(
    () => lines.filter((line) => line.billing_type === "recurring"),
    [lines],
  );

  const installments = useMemo(
    () =>
      generatePaymentInstallments({
        depositAmount: totals.depositAmount,
        balanceAmount: totals.balanceAmount,
        config: scheduleConfig,
      }),
    [totals.depositAmount, totals.balanceAmount, scheduleConfig],
  );

  const updateLine = (key: string, patch: Partial<ProposalLineDraft>) => {
    onChange(
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (key: string) => {
    onChange(lines.filter((line) => line.key !== key));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Proposal summary</CardTitle>
          <p className="text-sm text-muted-foreground">
            Live cart — edit amounts, quantities, and descriptions per line.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Select a base package from the catalog to start.
            </p>
          ) : null}

          {oneTimeLines.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                One-time
              </h3>
              {oneTimeLines.map((line) => (
                <CartLineRow
                  key={line.key}
                  line={line}
                  onChange={(patch) => updateLine(line.key, patch)}
                  onRemove={() => removeLine(line.key)}
                />
              ))}
            </section>
          ) : null}

          {recurringLines.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recurring
              </h3>
              {recurringLines.map((line) => (
                <CartLineRow
                  key={line.key}
                  line={line}
                  onChange={(patch) => updateLine(line.key, patch)}
                  onRemove={() => removeLine(line.key)}
                />
              ))}
            </section>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              onChange([
                ...lines,
                {
                  key: newLineKey(),
                  description: "Custom line",
                  quantity: 1,
                  unit_price: 0,
                  billing_type: "one_time",
                  billing_interval: null,
                  sort_order: lines.length,
                },
              ])
            }
          >
            <Plus className="size-4" />
            Custom line
          </Button>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">One-time subtotal</span>
              <MoneyText value={totals.oneTimeTotal} className="font-semibold" />
            </div>
            {totals.recurringLines.length > 0 ? (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Recurring subtotal</span>
                <span className="font-semibold tabular-nums">
                  <MoneyText value={totals.recurringSubtotal} />
                  <span className="text-muted-foreground font-normal">
                    /mo
                  </span>
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-2 border-t pt-2">
              <span className="font-medium">Project total (one-time)</span>
              <MoneyText
                value={totals.grandTotalOneTime}
                className="font-semibold text-base"
              />
            </div>
            <div className="flex justify-between gap-2 text-muted-foreground">
              <span>Deposit ({depositPercent}%)</span>
              <MoneyText value={totals.depositAmount} />
            </div>
            <div className="flex justify-between gap-2 text-muted-foreground">
              <span>Balance after deposit</span>
              <MoneyText value={totals.balanceAmount} />
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label>Deposit %</Label>
            <NumberInput
              source="deposit_percent"
              label={false}
              min={0}
              max={100}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Valid until <strong>{validUntil}</strong>
          </p>
        </CardContent>
      </Card>

      {totals.oneTimeTotal > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment plan</CardTitle>
            <p className="text-sm text-muted-foreground">
              50% deposit at signing + balance in installments.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProposalPaymentSchedulePanel
              config={scheduleConfig}
              onChange={onScheduleChange}
              depositAmount={totals.depositAmount}
              balanceAmount={totals.balanceAmount}
              compact
              showPreviewTable={false}
            />
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-2 py-1.5 font-medium">#</th>
                    <th className="px-2 py-1.5 font-medium">Due</th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((row) => (
                    <tr key={row.installment_number} className="border-b">
                      <td className="px-2 py-1.5">{row.label}</td>
                      <td className="px-2 py-1.5">{row.due_date}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        <MoneyText value={row.amount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
