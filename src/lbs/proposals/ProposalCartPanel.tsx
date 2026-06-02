import { ArrowRight, Loader2, ShoppingBag, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { NumberInput } from "@/components/admin/number-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isClientBillingSkipped } from "@/lbs/billing/clientBillingProvider";
import {
  generatePaymentInstallments,
  type PaymentScheduleConfig,
  type ProposalLineDraft,
  type ProposalTotals,
} from "@/lbs/proposals/proposalCommercialUtils";
import { INSTALLMENT_FREQUENCIES } from "@/lbs/proposals/proposalCommercialConstants";
import { MoneyText } from "@/lib/permissions/MoneyText";

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
    {children}
  </p>
);

const PlanDot = ({ variant }: { variant: "deposit" | "installment" }) => (
  <span
    className={cn(
      "size-2 shrink-0 rounded-full",
      variant === "deposit" ? "bg-amber-500" : "bg-primary",
    )}
    aria-hidden
  />
);

const planInputClass =
  "h-8 rounded-md border border-border/80 bg-background px-2 text-sm shadow-none tabular-nums focus-visible:ring-1 focus-visible:ring-ring";

const cartAmountInputClass =
  "h-8 rounded-md border-0 bg-muted/60 px-2.5 text-sm shadow-none tabular-nums focus-visible:ring-1 focus-visible:ring-ring";

const CartLineRow = ({
  line,
  isBasePackage,
  onChange,
  onRemove,
}: {
  line: ProposalLineDraft;
  isBasePackage: boolean;
  onChange: (patch: Partial<ProposalLineDraft>) => void;
  onRemove: () => void;
}) => (
  <div className="space-y-1 border-b border-border/60 py-2 last:border-b-0">
    <div className="flex items-start justify-between gap-2">
      <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">
        {line.description}
        {isBasePackage ? (
          <span className="font-medium text-primary"> · base</span>
        ) : null}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label="Remove line"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={0}
        step={0.01}
        value={line.unit_price}
        onChange={(event) =>
          onChange({ unit_price: Number(event.target.value) || 0 })
        }
        className={cn(cartAmountInputClass, "w-[5.25rem] text-left")}
        aria-label={`Amount for ${line.description}`}
      />
      <span className="text-sm text-muted-foreground">×</span>
      <Input
        type="number"
        min={0}
        step={1}
        value={line.quantity}
        onChange={(event) =>
          onChange({ quantity: Number(event.target.value) || 0 })
        }
        className={cn(cartAmountInputClass, "w-11 text-center")}
        aria-label={`Quantity for ${line.description}`}
      />
    </div>
  </div>
);

const installmentFrequencyPhrase = (
  frequency: PaymentScheduleConfig["installment_frequency"],
  count: number,
) => {
  const cadence =
    frequency === "weekly"
      ? "weekly"
      : frequency === "biweekly"
        ? "biweekly"
        : frequency === "monthly"
          ? "monthly"
          : "scheduled";
  return `${count} ${cadence} payment${count === 1 ? "" : "s"} of`;
};

export const ProposalCartPanel = ({
  lines,
  onChange,
  totals,
  depositPercent,
  scheduleConfig,
  onScheduleChange,
  isSaving = false,
}: {
  lines: ProposalLineDraft[];
  onChange: (lines: ProposalLineDraft[]) => void;
  totals: ProposalTotals;
  depositPercent: number;
  scheduleConfig: PaymentScheduleConfig;
  onScheduleChange: (config: PaymentScheduleConfig) => void;
  isSaving?: boolean;
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

  const balanceInstallments = installments.filter(
    (row) => row.label !== "Deposit (50%)",
  );
  const perInstallmentAmount = balanceInstallments[0]?.amount ?? 0;

  const updateLine = (key: string, patch: Partial<ProposalLineDraft>) => {
    onChange(
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (key: string) => {
    onChange(lines.filter((line) => line.key !== key));
  };

  const stripeSkipped = isClientBillingSkipped();
  const hasLines = lines.length > 0;

  return (
    <Card className="w-full min-w-0 overflow-hidden shadow-sm lg:sticky lg:top-4">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b bg-muted/20 px-3 py-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary">
            <ShoppingBag className="size-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight">
              Proposal summary
            </h2>
            <p className="text-sm text-muted-foreground">
              Edit amounts and quantities inline
            </p>
          </div>
        </div>

        <div className="space-y-3 px-3 py-2.5">
          {!hasLines ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Choose a base package to start building.
            </p>
          ) : null}

          {oneTimeLines.length > 0 ? (
            <section>
              <SectionLabel>One-time payment</SectionLabel>
              <div>
                {oneTimeLines.map((line) => (
                  <CartLineRow
                    key={line.key}
                    line={line}
                    isBasePackage={
                      line.package_id != null && line.addon_id == null
                    }
                    onChange={(patch) => updateLine(line.key, patch)}
                    onRemove={() => removeLine(line.key)}
                  />
                ))}
              </div>
              <div className="mt-1 space-y-1 text-sm">
                <div className="flex justify-between gap-2 text-muted-foreground">
                  <span>One-time subtotal</span>
                  <MoneyText value={totals.oneTimeTotal} className="tabular-nums" />
                </div>
                <div className="flex justify-between gap-2 border-t border-border/80 pt-1.5">
                  <span className="font-semibold text-foreground">Project total</span>
                  <MoneyText
                    value={totals.grandTotalOneTime}
                    className="text-base font-bold tabular-nums"
                  />
                </div>
              </div>
            </section>
          ) : null}

          {recurringLines.length > 0 ? (
            <section>
              <SectionLabel>Recurring (monthly)</SectionLabel>
              <div>
                {recurringLines.map((line) => (
                  <CartLineRow
                    key={line.key}
                    line={line}
                    isBasePackage={false}
                    onChange={(patch) => updateLine(line.key, patch)}
                    onRemove={() => removeLine(line.key)}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between gap-2 text-sm text-muted-foreground">
                <span>Recurring subtotal</span>
                <span className="font-semibold tabular-nums text-foreground">
                  <MoneyText value={totals.recurringSubtotal} />
                  <span className="font-normal text-muted-foreground"> /mo</span>
                </span>
              </div>
            </section>
          ) : null}

          {hasLines && totals.oneTimeTotal > 0 ? (
            <section className="space-y-2 border-t border-border/60 pt-2.5">
              <SectionLabel>Payment plan</SectionLabel>

              <div className="flex items-center gap-2">
                <PlanDot variant="deposit" />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm">
                  <span>Deposit at signing ({depositPercent}%)</span>
                  <MoneyText
                    value={totals.depositAmount}
                    className="shrink-0 font-bold tabular-nums"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-4 text-sm">
                <span className="text-foreground">Balance in</span>
                <Input
                  type="number"
                  min={1}
                  max={52}
                  className={cn(planInputClass, "w-12 text-center")}
                  value={scheduleConfig.installment_count}
                  onChange={(event) =>
                    onScheduleChange({
                      ...scheduleConfig,
                      installment_count: Math.max(
                        1,
                        Number(event.target.value) || 1,
                      ),
                    })
                  }
                />
                <span className="text-foreground">installments</span>
                <Select
                  value={scheduleConfig.installment_frequency}
                  onValueChange={(value) =>
                    onScheduleChange({
                      ...scheduleConfig,
                      installment_frequency:
                        value as PaymentScheduleConfig["installment_frequency"],
                    })
                  }
                >
                  <SelectTrigger
                    className={cn(planInputClass, "h-8 w-[7.25rem]")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTALLMENT_FREQUENCIES.filter(
                      (entry) => entry.value !== "custom",
                    ).map((entry) => (
                      <SelectItem key={entry.value} value={entry.value}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {balanceInstallments.length > 0 ? (
                <div className="flex items-center gap-2">
                  <PlanDot variant="installment" />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {installmentFrequencyPhrase(
                        scheduleConfig.installment_frequency,
                        scheduleConfig.installment_count,
                      )}
                    </span>
                    <MoneyText
                      value={perInstallmentAmount}
                      className="shrink-0 text-base font-bold tabular-nums"
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex justify-between gap-2 pl-4 text-xs leading-snug text-muted-foreground">
                <span>
                  {stripeSkipped
                    ? "Manual payment tracking"
                    : "Automatic debit (Stripe)"}
                </span>
                <span className="text-right">
                  {stripeSkipped
                    ? "billing skipped in dev"
                    : "when credentials are connected"}
                </span>
              </div>
            </section>
          ) : null}

          {hasLines ? (
            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-sm">
              <span className="text-muted-foreground">Proposal valid for</span>
              <div className="flex items-center gap-2">
                <NumberInput
                  source="validity_days"
                  label={false}
                  min={1}
                  max={365}
                  className="[&_.flex]:m-0 [&_input]:h-8 [&_input]:w-12 [&_input]:rounded-md [&_input]:border [&_input]:border-border/80 [&_input]:bg-background [&_input]:px-2 [&_input]:text-center [&_input]:text-sm"
                />
                <span className="text-muted-foreground">days</span>
              </div>
            </div>
          ) : null}
        </div>

        {hasLines ? (
          <div className="border-t bg-muted/10 px-3 py-2.5">
            <Button
              type="submit"
              className="h-10 w-full text-sm font-medium"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              Continue
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
