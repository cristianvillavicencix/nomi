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
import { buildInvoicePaymentSchedule } from "@/modules/billing/invoicePaymentUtils";
import { InvoicePaymentSchedulePanel } from "@/modules/billing/InvoicePaymentSchedulePanel";
import {
  INVOICE_REMAINDER_TIMING_OPTIONS,
  remainderTimingIsRecurring,
  type InvoiceRemainderScheduleConfig,
} from "@/modules/billing/invoiceRemainderSchedule";
import type { InvoiceOnlinePaymentSetup } from "@/modules/billing/onlinePaymentSetupBridge";
export type { InvoiceOnlinePaymentSetup, OnlinePaymentSetup } from "@/modules/billing/onlinePaymentSetupBridge";
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
  context?: "invoice" | "proposal";
};

const SectionHeader = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <div>
    <p className="text-sm font-semibold text-foreground">{title}</p>
    {description ? (
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    ) : null}
  </div>
);

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
    [
      total,
      depositAuto,
      depositPercent,
      draft.saveCard,
      dueDate,
      draft.remainderSchedule,
      issueDate,
    ],
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-info" />
            Online payment
          </DialogTitle>
          <DialogDescription>
            {context === "proposal"
              ? "These settings apply when this proposal becomes an invoice."
              : "Set up how the client pays online."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-3">
            <SectionHeader
              title="How will the client pay?"
              description="Pick one path. Everything below follows from this choice."
            />
            <div className="space-y-1">
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 transition-colors",
                  draft.paymentMode === "full" && "bg-muted/50",
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
                  <span className="text-sm font-medium">
                    Full amount in one payment
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Client checks out once for {formatMoney(total)}.
                  </span>
                </span>
              </label>

              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 transition-colors",
                  depositAuto && "bg-muted/50",
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
                    Deposit first, then automatic balance charges
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Client pays a deposit now; the rest is charged to the saved
                    card on your schedule.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader
              title={
                depositAuto
                  ? "Configure deposit & balance schedule"
                  : "Optional: save the card"
              }
              description={
                depositAuto
                  ? "After the deposit is paid, the card stays on file for the remaining charges."
                  : "If enabled, the card is stored when they pay the full amount."
              }
            />

            <div>
              {depositAuto ? (
                <div className="space-y-4">
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
                      due first, then{" "}
                      <span className="font-medium text-foreground">
                        {formatMoney(balanceAmount)}
                      </span>{" "}
                      on the schedule below
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
                            timing:
                              timing as InvoiceRemainderScheduleConfig["timing"],
                            installment_count: remainderTimingIsRecurring(
                              timing as InvoiceRemainderScheduleConfig["timing"],
                            )
                              ? Math.max(
                                  prev.remainderSchedule.installment_count,
                                  1,
                                )
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
                          (entry) =>
                            entry.value === draft.remainderSchedule.timing,
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
                        value={
                          draft.remainderSchedule.project_end_date ?? dueDate
                        }
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

                  {remainderTimingIsRecurring(
                    draft.remainderSchedule.timing,
                  ) ? (
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
                </div>
              ) : (
                <label className="flex items-start gap-2 px-2 py-2.5 text-sm">
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
                      Card is stored when they complete checkout.
                    </span>
                  </span>
                </label>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader
              title="What the client sees (in order)"
              description={
                depositAuto
                  ? "First the deposit, then each automatic charge on its due date."
                  : "A single payment for the full invoice amount."
              }
            />
            <div>
              {schedulePreview.length > 0 ? (
                <InvoicePaymentSchedulePanel
                  rows={schedulePreview}
                  title="Payment timeline"
                  description="This is the sequence on the client portal."
                />
              ) : null}
            </div>
          </section>
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
