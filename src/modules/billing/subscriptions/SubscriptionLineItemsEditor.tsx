import { Trash2 } from "lucide-react";
import { useState } from "react";
import { CatalogLineItemField } from "@/modules/billing/CatalogLineItemField";
import type { InvoiceLineDraft } from "@/modules/billing/invoiceLineUtils";
import { emptySubscriptionLine } from "@/modules/billing/subscriptions/subscriptionLineUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FloatingFieldShell,
  floatingFieldControlClassName,
} from "@/components/ui/floating-field";
import { cn } from "@/lib/utils";

type SubscriptionLineItemsEditorProps = {
  lines: InvoiceLineDraft[];
  onChange: (lines: InvoiceLineDraft[]) => void;
  billingInterval: "weekly" | "monthly" | "yearly";
  onBillingIntervalChange?: (interval: "weekly" | "monthly" | "yearly") => void;
  disabled?: boolean;
  currency?: string;
  /** @deprecated Searcher adds lines; kept for call-site compatibility. */
  hideAddButton?: boolean;
};

const SEARCH_STUB: Pick<
  InvoiceLineDraft,
  "title" | "item_detail" | "unit_price" | "package_id" | "addon_id"
> = {
  title: "",
  item_detail: "",
  unit_price: 0,
  package_id: null,
  addon_id: null,
};

export const SubscriptionLineItemsEditor = ({
  lines,
  onChange,
  billingInterval,
  onBillingIntervalChange,
  disabled = false,
}: SubscriptionLineItemsEditorProps) => {
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const updateLine = (key: string, patch: Partial<InvoiceLineDraft>) => {
    onChange(
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (key: string) => {
    onChange(lines.filter((line) => line.key !== key));
  };

  const addFromCatalog = (item: {
    title: string;
    item_detail: string;
    unit_price: number;
    package_id: number | null;
    addon_id: number | null;
    billing_interval?: "weekly" | "monthly" | "yearly" | null;
  }) => {
    if (item.billing_interval && onBillingIntervalChange) {
      onBillingIntervalChange(item.billing_interval);
    }
    onChange([
      ...lines,
      {
        ...emptySubscriptionLine(),
        title: item.title,
        item_detail: item.item_detail,
        unit_price: item.unit_price,
        package_id: item.package_id,
        addon_id: item.addon_id,
        quantity: 1,
        sort_order: lines.length,
      },
    ]);
  };

  return (
    <div className={cn("space-y-4", disabled && "pointer-events-none opacity-60")}>
      <CatalogLineItemField
        mode="add"
        line={SEARCH_STUB}
        onChange={() => {}}
        onAddItem={addFromCatalog}
        billingTypeFilter="recurring"
        defaultBillingInterval={billingInterval}
        suggestionMinWidth={520}
        labelVariant="floating"
        onCatalogPick={({ billing_interval }) => {
          if (billing_interval && onBillingIntervalChange) {
            onBillingIntervalChange(billing_interval);
          }
        }}
      />

      {lines.length > 0 ? (
        <div className="divide-y divide-border/70">
          {lines.map((line) => {
            const titleKey = `${line.key}-title`;
            const qtyKey = `${line.key}-qty`;
            const priceKey = `${line.key}-price`;
            const detailKey = `${line.key}-detail`;
            const qtyValue = Number.isFinite(line.quantity)
              ? String(line.quantity)
              : "";
            const priceValue = Number.isFinite(line.unit_price)
              ? String(line.unit_price)
              : "";

            return (
              <div key={line.key} className="space-y-3 py-4 first:pt-1 last:pb-0">
                <div className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem]">
                    <FloatingFieldShell
                      active={
                        focusedField === titleKey ||
                        Boolean(line.title.trim())
                      }
                      label="Item"
                      htmlFor={titleKey}
                    >
                      <Input
                        id={titleKey}
                        value={line.title}
                        onChange={(event) =>
                          updateLine(line.key, {
                            title: event.target.value,
                            package_id: null,
                            addon_id: null,
                          })
                        }
                        onFocus={() => setFocusedField(titleKey)}
                        onBlur={() => setFocusedField(null)}
                        className={cn(
                          floatingFieldControlClassName,
                          "font-medium",
                        )}
                      />
                    </FloatingFieldShell>
                    <FloatingFieldShell
                      active={focusedField === qtyKey || qtyValue.length > 0}
                      label="Qty"
                      htmlFor={qtyKey}
                    >
                      <Input
                        id={qtyKey}
                        type="number"
                        min={0}
                        step="0.01"
                        value={qtyValue}
                        onChange={(event) =>
                          updateLine(line.key, {
                            quantity: Number(event.target.value),
                          })
                        }
                        onFocus={() => setFocusedField(qtyKey)}
                        onBlur={() => setFocusedField(null)}
                        className={floatingFieldControlClassName}
                      />
                    </FloatingFieldShell>
                    <FloatingFieldShell
                      active={
                        focusedField === priceKey || priceValue.length > 0
                      }
                      label="Unit price"
                      htmlFor={priceKey}
                    >
                      <Input
                        id={priceKey}
                        type="number"
                        min={0}
                        step="0.01"
                        value={priceValue}
                        onChange={(event) =>
                          updateLine(line.key, {
                            unit_price: Number(event.target.value),
                          })
                        }
                        onFocus={() => setFocusedField(priceKey)}
                        onBlur={() => setFocusedField(null)}
                        className={floatingFieldControlClassName}
                      />
                    </FloatingFieldShell>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mt-1 shrink-0 text-muted-foreground"
                    onClick={() => removeLine(line.key)}
                    aria-label="Remove line"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <FloatingFieldShell
                  active={
                    focusedField === detailKey ||
                    Boolean(line.item_detail?.trim())
                  }
                  label="Description"
                  className="min-h-[2.5rem] items-stretch"
                >
                  <Textarea
                    value={line.item_detail ?? ""}
                    onChange={(event) =>
                      updateLine(line.key, {
                        item_detail: event.target.value,
                      })
                    }
                    onFocus={() => setFocusedField(detailKey)}
                    onBlur={() => setFocusedField(null)}
                    placeholder=" "
                    rows={Math.max(
                      2,
                      line.item_detail?.split("\n").length ?? 1,
                    )}
                    className={cn(
                      floatingFieldControlClassName,
                      "h-auto min-h-[2.5rem] resize-y py-2 text-muted-foreground leading-relaxed whitespace-pre-wrap",
                    )}
                  />
                </FloatingFieldShell>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
