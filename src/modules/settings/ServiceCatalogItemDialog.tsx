import { useEffect, useState } from "react";
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
});

export const ServiceCatalogItemDialog = ({
  open,
  onOpenChange,
  title,
  initial,
  sortOrder,
  onSave,
  variant = "package",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial?: Partial<CatalogItemDraft>;
  sortOrder: number;
  onSave: (draft: CatalogItemDraft) => void | Promise<void>;
  variant?: "package" | "addon";
}) => {
  const [draft, setDraft] = useState<CatalogItemDraft>(emptyDraft(sortOrder));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft({ ...emptyDraft(sortOrder), ...initial });
  }, [open, initial, sortOrder]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="catalog-name">Name</Label>
            <Input
              id="catalog-name"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-description">Description</Label>
            <Textarea
              id="catalog-description"
              rows={3}
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={draft.category}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, category: value }))
                }
              >
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label htmlFor="catalog-price">Suggested price</Label>
              <Input
                id="catalog-price"
                type="number"
                min={0}
                step={0.01}
                value={draft.suggested_price}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    suggested_price: Number(event.target.value) || 0,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Editable per proposal in the builder.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
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
                <SelectTrigger>
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
            {draft.billing_type === "recurring" ? (
              <div className="space-y-2">
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
                  <SelectTrigger>
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
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={draft.active}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, active: checked }))
              }
            />
            <Label>Active in catalog</Label>
          </div>
          {variant === "package" ? (
            <div className="space-y-4 rounded-md border p-4">
              <p className="text-sm font-medium">Where this product appears</p>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Ticket billing</Label>
                  <p className="text-xs text-muted-foreground">
                    Show in ticket delivery package billing.
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Pricing mode</Label>
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
                      <SelectTrigger>
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
                  <div className="space-y-2">
                    <Label htmlFor="catalog-ticket-slug">Ticket key</Label>
                    <Input
                      id="catalog-ticket-slug"
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
                <div>
                  <Label>Book now</Label>
                  <p className="text-xs text-muted-foreground">
                    Offer on public booking pages and links.
                  </p>
                </div>
                <Switch
                  checked={Boolean(draft.booking_enabled)}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({ ...current, booking_enabled: checked }))
                  }
                />
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!draft.name.trim() || isSaving}
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
