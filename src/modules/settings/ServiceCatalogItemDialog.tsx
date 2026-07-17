import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  BILLING_INTERVALS,
  BILLING_TYPES,
  DEFAULT_CURRENCY,
} from "@/modules/proposals/proposalCommercialConstants";
import { CATALOG_CATEGORIES } from "@/modules/catalog/catalogConstants";
import { slugifyTicketBillingSlug } from "@/modules/catalog/ticketCatalogPricing";

export type CatalogItemDraft = {
  name: string;
  description: string;
  category: string;
  suggested_price: number;
  currency: string;
  billing_type: "one_time" | "recurring";
  billing_interval: "weekly" | "monthly" | "yearly" | null;
  active: boolean;
  sort_order: number;
  booking_enabled?: boolean;
  ticket_billing_enabled?: boolean;
  ticket_pricing_mode?: "flat" | "supplement_lines";
  ticket_billing_slug?: string;
};

const emptyDraft = (sortOrder: number): CatalogItemDraft => ({
  name: "",
  description: "",
  category: "web",
  suggested_price: 0,
  currency: DEFAULT_CURRENCY,
  billing_type: "one_time",
  billing_interval: null,
  active: true,
  sort_order: sortOrder,
  booking_enabled: false,
  ticket_billing_enabled: false,
  ticket_pricing_mode: "flat",
  ticket_billing_slug: "",
});

export const ServiceCatalogItemDialog = ({
  open,
  onOpenChange,
  title,
  initial,
  sortOrder,
  onSave,
  variant = "package",
  mode = "full",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial?: Partial<CatalogItemDraft>;
  sortOrder: number;
  onSave: (draft: CatalogItemDraft) => void | Promise<void>;
  variant?: "package" | "addon";
  /** Quick = compact create for invoice/proposal builders. */
  mode?: "full" | "quick";
}) => {
  const isQuick = mode === "quick";
  const [draft, setDraft] = useState<CatalogItemDraft>(emptyDraft(sortOrder));
  const [isSaving, setIsSaving] = useState(false);
  const [showMore, setShowMore] = useState(!isQuick);

  useEffect(() => {
    if (!open) return;
    setDraft({ ...emptyDraft(sortOrder), ...initial });
    setShowMore(!isQuick);
  }, [open, initial, sortOrder, isQuick]);

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim(),
        billing_interval:
          draft.billing_type === "recurring"
            ? (draft.billing_interval ?? "monthly")
            : null,
        ticket_billing_slug:
          variant === "package" && draft.ticket_billing_enabled
            ? draft.ticket_billing_slug?.trim() ||
              slugifyTicketBillingSlug(draft.name)
            : null,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const placementSection =
    variant === "package" ? (
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Where this appears
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-none">Ticket billing</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ticket delivery packages
            </p>
          </div>
          <Switch
            checked={Boolean(draft.ticket_billing_enabled)}
            onCheckedChange={(checked) =>
              setDraft((current) => ({
                ...current,
                ticket_billing_enabled: checked,
                ticket_pricing_mode: current.ticket_pricing_mode ?? "flat",
                ticket_billing_slug:
                  current.ticket_billing_slug ||
                  slugifyTicketBillingSlug(current.name),
              }))
            }
          />
        </div>
        {draft.ticket_billing_enabled ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Pricing mode</Label>
              <Select
                value={draft.ticket_pricing_mode ?? "flat"}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    ticket_pricing_mode:
                      value as CatalogItemDraft["ticket_pricing_mode"],
                  }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat price</SelectItem>
                  <SelectItem value="supplement_lines">
                    Supplement line count
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="catalog-ticket-slug" className="text-xs">
                Ticket key
              </Label>
              <Input
                id="catalog-ticket-slug"
                className="h-9"
                value={draft.ticket_billing_slug ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    ticket_billing_slug: event.target.value,
                  }))
                }
                placeholder={slugifyTicketBillingSlug(draft.name || "product")}
              />
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-none">Book now</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Public booking pages
            </p>
          </div>
          <Switch
            checked={Boolean(draft.booking_enabled)}
            onCheckedChange={(checked) =>
              setDraft((current) => ({
                ...current,
                booking_enabled: checked,
              }))
            }
          />
        </div>
      </div>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {isQuick ? (
            <p className="text-xs text-muted-foreground">
              Saved to catalog and applied to this line.
            </p>
          ) : null}
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="catalog-name">Name</Label>
            <Input
              id="catalog-name"
              autoFocus
              placeholder="e.g. Consulting call"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && draft.name.trim()) {
                  event.preventDefault();
                  void handleSave();
                }
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="catalog-price">Price</Label>
              <Input
                id="catalog-price"
                type="number"
                min={0}
                step={0.01}
                className="h-9 tabular-nums"
                value={draft.suggested_price}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    suggested_price: Number(event.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Billing</Label>
              <Select
                value={draft.billing_type}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    billing_type: value as CatalogItemDraft["billing_type"],
                    billing_interval:
                      value === "recurring"
                        ? (current.billing_interval ?? "monthly")
                        : null,
                  }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_TYPES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {draft.billing_type === "recurring" ? (
            <div className="space-y-1.5">
              <Label>Interval</Label>
              <Select
                value={draft.billing_interval ?? "monthly"}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    billing_interval:
                      value as CatalogItemDraft["billing_interval"],
                  }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_INTERVALS.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={draft.category}
              onValueChange={(value) =>
                setDraft((current) => ({ ...current, category: value }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATALOG_CATEGORIES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="catalog-description">
              Description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="catalog-description"
              rows={isQuick ? 2 : 3}
              placeholder="Short catalog note…"
              className="max-h-28 resize-y overflow-y-auto text-sm"
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium leading-none">Active</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Show in catalog search
              </p>
            </div>
            <Switch
              checked={draft.active}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, active: checked }))
              }
            />
          </div>

          {variant === "package" ? (
            isQuick ? (
              <div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setShowMore((value) => !value)}
                >
                  More options
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform",
                      showMore && "rotate-180",
                    )}
                  />
                </button>
                {showMore ? (
                  <div className="mt-2 space-y-3">{placementSection}</div>
                ) : null}
              </div>
            ) : (
              placementSection
            )
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t bg-background px-5 py-3 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!draft.name.trim() || isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving ? "Saving…" : isQuick ? "Save & use" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
