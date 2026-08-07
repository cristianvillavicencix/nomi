import { Plus, Trash2 } from "lucide-react";
import { CatalogLineItemField } from "@/modules/billing/CatalogLineItemField";
import type { InvoiceLineDraft } from "@/modules/billing/invoiceLineUtils";
import {
  emptySubscriptionLine,
  sumSubscriptionLinesAmount,
} from "@/modules/billing/subscriptions/subscriptionLineUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { cn } from "@/lib/utils";

type SubscriptionLineItemsEditorProps = {
  lines: InvoiceLineDraft[];
  onChange: (lines: InvoiceLineDraft[]) => void;
  billingInterval: "weekly" | "monthly" | "yearly";
  onBillingIntervalChange?: (interval: "weekly" | "monthly" | "yearly") => void;
  disabled?: boolean;
  currency?: string;
};

export const SubscriptionLineItemsEditor = ({
  lines,
  onChange,
  billingInterval,
  onBillingIntervalChange,
  disabled = false,
  currency = "USD",
}: SubscriptionLineItemsEditorProps) => {
  const total = sumSubscriptionLinesAmount(lines);

  const updateLine = (key: string, patch: Partial<InvoiceLineDraft>) => {
    onChange(
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (key: string) => {
    if (lines.length <= 1) return;
    onChange(lines.filter((line) => line.key !== key));
  };

  const addLine = () => {
    onChange([...lines, emptySubscriptionLine()]);
  };

  return (
    <div className={cn("space-y-4", disabled && "pointer-events-none opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <Label>Plan &amp; add-ons</Label>
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="size-4" />
          Add line
        </Button>
      </div>

      <div className="space-y-4">
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="space-y-3 rounded-lg border bg-muted/10 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Line {index + 1}
              </p>
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeLine(line.key)}
                  aria-label="Remove line"
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>

            <CatalogLineItemField
              line={line}
              billingTypeFilter="recurring"
              defaultBillingInterval={billingInterval}
              suggestionMinWidth={520}
              onCatalogPick={({ billing_interval }) => {
                if (billing_interval && onBillingIntervalChange) {
                  onBillingIntervalChange(billing_interval);
                }
              }}
              onChange={(patch) => updateLine(line.key, patch)}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={Number.isFinite(line.quantity) ? line.quantity : ""}
                  onChange={(event) =>
                    updateLine(line.key, {
                      quantity: Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Unit price</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={
                    Number.isFinite(line.unit_price) ? line.unit_price : ""
                  }
                  onChange={(event) =>
                    updateLine(line.key, {
                      unit_price: Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium tabular-nums">
                  <MoneyText
                    amount={
                      (Number(line.quantity) || 0) *
                      (Number(line.unit_price) || 0)
                    }
                    currency={currency}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end border-t pt-3 text-sm font-semibold">
        Total{" "}
        <span className="ml-2 tabular-nums">
          <MoneyText amount={total} currency={currency} />
        </span>
      </div>
    </div>
  );
};
