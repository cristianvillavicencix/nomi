import { useEffect, useMemo, useState } from "react";
import type { DeliverableBillingKind } from "@/modules/tickets/supplementPricing";
import {
  buildDeliverablePricingLine,
  buildTicketBillingOptions,
  formatSupplementMoney,
  normalizePropertyAddress,
} from "@/modules/tickets/supplementPricing";
import { useTicketCatalogPackages } from "@/modules/catalog/useTicketCatalogPackages";
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
  service_package_id?: number | string | null;
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
  const { ticketPackages } = useTicketCatalogPackages();
  const billingOptions = useMemo(
    () => buildTicketBillingOptions(ticketPackages),
    [ticketPackages],
  );

  const [kind, setKind] = useState<DeliverableBillingKind>("supplement");
  const [packageId, setPackageId] = useState<string>("");
  const [lineCount, setLineCount] = useState("55");

  useEffect(() => {
    if (!open) return;
    const initialOption =
      billingOptions.find(
        (option) =>
          initial?.service_package_id != null &&
          String(option.packageId) === String(initial.service_package_id),
      ) ??
      billingOptions.find((option) => option.kind === initial?.billing_kind);

    setKind(initialOption?.kind ?? billingOptions[0]?.kind ?? "supplement");
    setPackageId(
      initial?.service_package_id != null
        ? String(initial.service_package_id)
        : initialOption?.packageId != null
          ? String(initialOption.packageId)
          : "",
    );
    setLineCount(
      initial?.billing_line_count != null
        ? String(initial.billing_line_count)
        : "55",
    );
  }, [open, initial, billingOptions]);

  const address = normalizePropertyAddress(propertyAddress);
  const parsedLineCount = Math.max(0, Math.floor(Number(lineCount) || 0));
  const selectedOption = billingOptions.find((option) => option.kind === kind);

  const previewLine = useMemo(
    () =>
      buildDeliverablePricingLine(
        kind,
        address,
        selectedOption?.needsLineCount ? parsedLineCount : null,
        ticketPackages,
        packageId || selectedOption?.packageId,
      ),
    [
      kind,
      address,
      parsedLineCount,
      ticketPackages,
      packageId,
      selectedOption,
    ],
  );

  const canConfirm =
    Boolean(selectedOption) &&
    (!selectedOption?.needsLineCount || parsedLineCount > 0);

  const handleKindChange = (nextKind: DeliverableBillingKind) => {
    setKind(nextKind);
    const option = billingOptions.find((entry) => entry.kind === nextKind);
    setPackageId(option?.packageId != null ? String(option.packageId) : "");
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      billing_kind: kind,
      billing_line_count: selectedOption?.needsLineCount ? parsedLineCount : null,
      service_package_id: packageId || selectedOption?.packageId || null,
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
              : "Choose a catalog product for this file."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deliverable-billing-kind">Product</Label>
            <Select
              value={kind}
              onValueChange={(value) =>
                handleKindChange(value as DeliverableBillingKind)
              }
            >
              <SelectTrigger id="deliverable-billing-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {billingOptions.map((option) => (
                  <SelectItem key={String(option.packageId ?? option.kind)} value={option.kind}>
                    {option.label}
                    {option.flatPrice != null
                      ? ` · ${formatSupplementMoney(option.flatPrice)}`
                      : null}
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
            </div>
          ) : null}

          <div
            className={cn(
              "rounded-md border bg-muted/30 p-3 text-sm",
              !canConfirm && "opacity-70",
            )}
          >
            <p className="font-medium">{previewLine.description}</p>
            <p className="mt-1 text-muted-foreground">
              Total: {formatSupplementMoney(previewLine.lineTotal)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
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
