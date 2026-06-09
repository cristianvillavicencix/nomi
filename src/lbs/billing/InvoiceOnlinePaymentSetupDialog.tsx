import { useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { buildInvoicePaymentSchedule } from "@/lbs/billing/invoicePaymentUtils";
import { InvoicePaymentSchedulePanel } from "@/lbs/billing/InvoicePaymentSchedulePanel";
import {
  generateInvoiceBalanceCharges,
  INVOICE_REMAINDER_TIMING_OPTIONS,
  remainderTimingIsRecurring,
} from "@/lbs/billing/invoiceRemainderSchedule";
import type { InvoiceOnlinePaymentSetup } from "@/lbs/billing/onlinePaymentSetupBridge";
export type { InvoiceOnlinePaymentSetup, OnlinePaymentSetup } from "@/lbs/billing/onlinePaymentSetupBridge";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { cn } from "@/lib/utils";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );

type InvoiceOnlinePaymentSetupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  issueDate: string;
  dueDate: string;
  value: InvoiceOnlinePaymentSetup;
  onApply: (value: InvoiceOnlinePaymentSetup) => void;
  /** Adjust helper copy for invoice vs proposal builder. */
  context?: "invoice" | "proposal";
};

export const InvoiceOnlinePaymentSetupDialog = ({
  open,
  onOpenChange,
  total,
  issueDate,
  dueDate,
  value,
  onApply,
  context = "invoice",
}: InvoiceOnlinePaymentSetupDialogProps) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const depositPercent = Math.min(Math.max(draft.depositPercent, 1), 99);
  const depositAmount =
    Math.round(total * (depositPercent / 100) * 100) / 100;
  const balanceAmount = Math.max(
    Math.round((total - depositAmount) * 100) / 100,
    0,
  );
  const depositAuto = draft.paymentMode === "deposit_auto";

  const balanceCharges = useMemo(
    () =>
      depositAuto
        ? generateInvoiceBalanceCharges({
            balanceAmount,
            config: draft.remainderSchedule,
            invoiceDueDate: dueDate,
            issueDate,
          })
        : [],
    [
      balanceAmount,
      depositAuto,
      draft.remainderSchedule,
      dueDate,
      issueDate,
    ],
  );

  const schedulePreview = useMemo(
    () =>
      buildInvoicePaymentSchedule({
        total,
        upfrontPercent: depositAuto ? depositPercent : 100,
        autoChargeRemainder: depositAuto,
        saveCard: depositAuto || draft.saveCard,
        dueDate,
        remainderSchedule: depositAuto ? draft.remainderSchedule : null,
        issueDate,
      }),
    [total, depositAuto, depositPercent, draft.saveCard, dueDate, draft.remainderSchedule, issueDate],
  );

  const apply = () => {
    onApply({
      ...draft,
      depositPercent,
      saveCard: depositAuto ? true : draft.saveCard,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-[#0D3B6E]" />
            Online payment
          </DialogTitle>
          <DialogDescription>
            {context === "proposal"
              ? "Same settings used when this proposal becomes an invoice — deposit, auto-charges, and saved card."
              : "Choose how the client pays this invoice online. Deposits can split the balance over time with automatic card charges."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                draft.paymentMode === "full"
                  ? "border-[#0D3B6E]/40 bg-slate-50/80"
                  : "border-slate-200",
              )}
            >
              <input
                type="radio"
                name="invoice-payment-mode"
                className="mt-1"
                checked={draft.paymentMode === "full"}
                onChange={() =>
                  setDraft((prev) => ({ ...prev, paymentMode: "full" }))
                }
              />
              <span>
                <span className="text-sm font-medium">Full amount when they pay</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  One checkout for {formatMoney(total)} — amount is fixed.
                </span>
              </span>
            </label>

            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                depositAuto
                  ? "border-[#0D3B6E]/40 bg-slate-50/80"
                  : "border-slate-200",
              )}
            >
              <input
                type="radio"
                name="invoice-payment-mode"
                className="mt-1"
                checked={depositAuto}
                onChange={() =>
                  setDraft((prev) => ({
                    ...prev,
                    paymentMode: "deposit_auto",
                    saveCard: true,
                  }))
                }
              />
              <span className="min-w-0 flex-1">
                <span className="text-sm font-medium">
                  Deposit now, charge remainder automatically
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Collect a deposit now; schedule the rest on the saved card.
                </span>
              </span>
            </label>
          </div>

          {depositAuto ? (
            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="invoice-deposit-pct">Deposit</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="invoice-deposit-pct"
                      type="number"
                      min={1}
                      max={99}
                      className="h-9 w-16 tabular-nums"
                      value={draft.depositPercent}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          depositPercent: Math.min(
                            99,
                            Math.max(1, Number(event.target.value) || 50),
                          ),
                        }))
                      }
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {formatMoney(depositAmount)}
                  </span>{" "}
                  now ·{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(balanceAmount)}
                  </span>{" "}
                  balance
                </p>
              </div>

              <div className="space-y-1">
                <Label>When to charge the balance</Label>
                <Select
                  value={draft.remainderSchedule.timing}
                  onValueChange={(timing) =>
                    setDraft((prev) => ({
                      ...prev,
                      remainderSchedule: {
                        ...prev.remainderSchedule,
                        timing: timing as InvoiceRemainderScheduleConfig["timing"],
                        installment_count: remainderTimingIsRecurring(
                          timing as InvoiceRemainderScheduleConfig["timing"],
                        )
                          ? Math.max(prev.remainderSchedule.installment_count, 1)
                          : 1,
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_REMAINDER_TIMING_OPTIONS.map((entry) => (
                      <SelectItem key={entry.value} value={entry.value}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {
                    INVOICE_REMAINDER_TIMING_OPTIONS.find(
                      (entry) => entry.value === draft.remainderSchedule.timing,
                    )?.description
                  }
                </p>
              </div>

              {draft.remainderSchedule.timing === "project_end" ? (
                <div className="space-y-1">
                  <Label htmlFor="project-end-date">Project end date</Label>
                  <Input
                    id="project-end-date"
                    type="date"
                    value={draft.remainderSchedule.project_end_date ?? dueDate}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        remainderSchedule: {
                          ...prev.remainderSchedule,
                          project_end_date: event.target.value || dueDate,
                        },
                      }))
                    }
                  />
                </div>
              ) : null}

              {remainderTimingIsRecurring(draft.remainderSchedule.timing) ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Number of installments</Label>
                    <Input
                      type="number"
                      min={1}
                      max={52}
                      value={draft.remainderSchedule.installment_count}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          remainderSchedule: {
                            ...prev.remainderSchedule,
                            installment_count: Math.min(
                              52,
                              Math.max(1, Number(event.target.value) || 1),
                            ),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>First balance charge</Label>
                    <Input
                      type="date"
                      value={
                        draft.remainderSchedule.balance_start_date ?? ""
                      }
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          remainderSchedule: {
                            ...prev.remainderSchedule,
                            balance_start_date:
                              event.target.value || null,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}

              {balanceCharges.length > 0 ? (
                <div className="overflow-x-auto rounded-md border bg-background text-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs">
                        <th className="px-3 py-2 font-medium">Charge</th>
                        <th className="px-3 py-2 font-medium">Due</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanceCharges.map((row) => (
                        <tr key={row.installment_number} className="border-b">
                          <td className="px-3 py-2">{row.label}</td>
                          <td className="px-3 py-2 tabular-nums">{row.due_date}</td>
                          <td className="px-3 py-2 text-right">
                            <MoneyText value={row.amount} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Card is saved when the client pays the deposit. Remaining charges
                run automatically — no manual follow-up.
              </p>
            </div>
          ) : (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={draft.saveCard}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({
                    ...prev,
                    saveCard: checked === true,
                  }))
                }
              />
              <span>
                <span className="font-medium">Save client card</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Card will be saved when the client pays online.
                </span>
              </span>
            </label>
          )}

          {schedulePreview.length > 0 ? (
            <InvoicePaymentSchedulePanel
              rows={schedulePreview}
              title="Client will see"
              description="Preview of the payment schedule on the portal."
              className="border-slate-200"
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={apply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
