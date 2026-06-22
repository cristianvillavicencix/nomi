import { useEffect, useMemo, useState } from "react";
import type { DeliverableBillingKind } from "@/modules/tickets/supplementPricing";
import {
  buildDeliverablePricingLine,
  calculateSupplementTotalForLineCount,
  DELIVERABLE_BILLING_OPTIONS,
  formatSupplementMoney,
  normalizePropertyAddress,
} from "@/modules/tickets/supplementPricing";
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
import { cn } from "@/lib/utils";

export type DeliverableBillingSelection = {
  billing_kind: DeliverableBillingKind;
  billing_line_count: number | null;
};

type TicketDeliverableBillingDialogProps = {
  open: boolean;
  fileName?: string | null;
  propertyAddress: string;
  initial?: DeliverableBillingSelection | null;
  confirmLabel?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selection: DeliverableBillingSelection) => void;
};

export const TicketDeliverableBillingDialog = ({
  open,
  fileName,
  propertyAddress,
  initial,
  confirmLabel = "Add to delivery package",
  onOpenChange,
  onConfirm,
}: TicketDeliverableBillingDialogProps) => {
  const [kind, setKind] = useState<DeliverableBillingKind>("supplement");
  const [lineCount, setLineCount] = useState("55");

  useEffect(() => {
    if (!open) return;
    setKind(initial?.billing_kind ?? "supplement");
    setLineCount(
      initial?.billing_line_count != null
        ? String(initial.billing_line_count)
        : "55",
    );
  }, [open, initial]);

  const address = normalizePropertyAddress(propertyAddress);
  const parsedLineCount = Math.max(0, Math.floor(Number(lineCount) || 0));
  const selectedOption = DELIVERABLE_BILLING_OPTIONS.find(
    (option) => option.kind === kind,
  );

  const previewLine = useMemo(
    () =>
      buildDeliverablePricingLine(
        kind,
        address,
        kind === "supplement" ? parsedLineCount : null,
      ),
    [kind, address, parsedLineCount],
  );

  const canConfirm =
    kind !== "supplement" || parsedLineCount > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      billing_kind: kind,
      billing_line_count: kind === "supplement" ? parsedLineCount : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delivery package billing</DialogTitle>
          <DialogDescription>
            {fileName
              ? `How should we bill "${fileName}"?`
              : "Choose the billing type for this file."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deliverable-billing-kind">Type</Label>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as DeliverableBillingKind)}
            >
              <SelectTrigger id="deliverable-billing-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERABLE_BILLING_OPTIONS.map((option) => (
                  <SelectItem key={option.kind} value={option.kind}>
                    {option.label}
                    {option.flatPrice != null
                      ? ` · ${formatSupplementMoney(option.flatPrice)}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOption?.needsLineCount ? (
            <div className="space-y-2">
              <Label htmlFor="deliverable-line-count">Line count</Label>
              <Input
                id="deliverable-line-count"
                type="number"
                min={1}
                value={lineCount}
                onChange={(event) => setLineCount(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Base ${calculateSupplementTotalForLineCount(50).toFixed(0)} includes
                50 lines, then $0.50 per extra line.
              </p>
            </div>
          ) : null}

          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Invoice line preview
            </p>
            <p className="mt-1 font-medium">{previewLine.description}</p>
            <p className={cn("mt-1 tabular-nums text-muted-foreground")}>
              {formatSupplementMoney(previewLine.lineTotal)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canConfirm} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
