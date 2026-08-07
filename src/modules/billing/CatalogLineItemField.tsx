import { Loader2, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCreate, useGetIdentity, useGetList, useNotify } from "ra-core";
import type { InvoiceLineDraft } from "@/modules/billing/invoiceLineUtils";
import {
  ServiceCatalogItemDialog,
  type CatalogItemDraft,
} from "@/modules/settings/ServiceCatalogItemDialog";
import type { ServiceAddon, ServicePackage } from "@/modules/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CatalogSuggestion = {
  id: string;
  kind: "package" | "addon";
  title: string;
  item_detail?: string;
  unit_price: number;
  package_id?: number | null;
  addon_id?: number | null;
  billing_interval?: "weekly" | "monthly" | "yearly" | null;
};

type CatalogLineItemFieldProps = {
  line: Pick<
    InvoiceLineDraft,
    "title" | "item_detail" | "unit_price" | "package_id" | "addon_id"
  >;
  onChange: (patch: Partial<InvoiceLineDraft>) => void;
  className?: string;
  billingTypeFilter?: "one_time" | "recurring" | "all";
  defaultBillingInterval?: "weekly" | "monthly" | "yearly";
  suggestionMinWidth?: number;
  onCatalogPick?: (item: {
    billing_interval?: "weekly" | "monthly" | "yearly" | null;
  }) => void;
};

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
};

const SUGGESTION_LIMIT = 6;
const DROPDOWN_MIN_WIDTH = 640;

const formatSuggestionPrice = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const filterSuggestions = (items: CatalogSuggestion[], query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.item_detail?.toLowerCase().includes(q),
  );
};

export const CatalogLineItemField = ({
  line,
  onChange,
  className,
  billingTypeFilter = "all",
  defaultBillingInterval = "monthly",
  suggestionMinWidth = DROPDOWN_MIN_WIDTH,
  onCatalogPick,
}: CatalogLineItemFieldProps) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const orgId = Number(identity?.org_id ?? 1);
  const [createPackage] = useCreate();

  const [query, setQuery] = useState(line.title);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickingRef = useRef(false);
  const lastPickIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (pickingRef.current) {
      pickingRef.current = false;
      return;
    }
    setQuery(line.title);
  }, [line.title]);

  const updatePosition = () => {
    const anchor = rootRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const tableCell = anchor.closest("td");
    const cellRect = tableCell?.getBoundingClientRect();
    const baseWidth = cellRect?.width ?? rect.width;
    const width = Math.min(
      Math.max(baseWidth, suggestionMinWidth),
      window.innerWidth - 24,
    );
    setPosition({
      top: rect.bottom + 4,
      left: Math.min(
        cellRect?.left ?? rect.left,
        window.innerWidth - width - 12,
      ),
      width,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const anchor = rootRef.current;
    if (!anchor) return;

    const resizeObserver = new ResizeObserver(() => updatePosition());
    resizeObserver.observe(anchor);
    const textarea = anchor.querySelector("textarea");
    if (textarea) resizeObserver.observe(textarea);

    const handleReposition = () => updatePosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, query, line.item_detail]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest("[data-invoice-item-suggestions]")
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const { data: packages = [] } = useGetList<ServicePackage>(
    "service_packages",
    {
      filter: { "active@eq": true },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "sort_order", order: "ASC" },
    },
    { staleTime: 60_000 },
  );

  const { data: addons = [] } = useGetList<ServiceAddon>("service_addons", {
    filter: { "active@eq": true },
    pagination: { page: 1, perPage: 500 },
    sort: { field: "sort_order", order: "ASC" },
  });

  const eligiblePackages = useMemo(
    () =>
      packages.filter(
        (pkg) =>
          billingTypeFilter === "all" || pkg.billing_type === billingTypeFilter,
      ),
    [packages, billingTypeFilter],
  );

  const eligibleAddons = useMemo(
    () =>
      addons.filter(
        (addon) =>
          billingTypeFilter === "all" ||
          addon.billing_type === billingTypeFilter,
      ),
    [addons, billingTypeFilter],
  );

  const packageSuggestions = useMemo<CatalogSuggestion[]>(
    () =>
      eligiblePackages.map((pkg) => ({
        id: `pkg-${pkg.id}`,
        kind: "package" as const,
        title: pkg.name,
        item_detail: pkg.description?.trim() || undefined,
        unit_price: pkg.suggested_price,
        package_id: Number(pkg.id),
        addon_id: null,
        billing_interval: pkg.billing_interval ?? null,
      })),
    [eligiblePackages],
  );

  const addonSuggestions = useMemo<CatalogSuggestion[]>(
    () =>
      eligibleAddons.map((addon) => ({
        id: `addon-${addon.id}`,
        kind: "addon" as const,
        title: addon.name,
        item_detail: addon.description?.trim() || undefined,
        unit_price: addon.suggested_price,
        package_id: addon.package_id ? Number(addon.package_id) : null,
        addon_id: Number(addon.id),
        billing_interval: addon.billing_interval ?? null,
      })),
    [eligibleAddons],
  );

  const allSuggestions = useMemo(
    () => [...packageSuggestions, ...addonSuggestions],
    [packageSuggestions, addonSuggestions],
  );

  const trimmedQuery = query.trim();

  const filteredPackages = useMemo(
    () =>
      filterSuggestions(packageSuggestions, query).slice(0, SUGGESTION_LIMIT),
    [packageSuggestions, query],
  );

  const filteredAddons = useMemo(
    () => filterSuggestions(addonSuggestions, query).slice(0, SUGGESTION_LIMIT),
    [addonSuggestions, query],
  );

  const hasResults = filteredPackages.length > 0 || filteredAddons.length > 0;

  const hasExactMatch = useMemo(
    () =>
      trimmedQuery.length > 0 &&
      allSuggestions.some(
        (item) => item.title.toLowerCase() === trimmedQuery.toLowerCase(),
      ),
    [allSuggestions, trimmedQuery],
  );

  const showCreateOption = open && trimmedQuery.length > 0 && !hasExactMatch;

  const createCatalogMutation = useMutation({
    mutationFn: async (draft: CatalogItemDraft) => {
      // useCreate(..., { returnPromise: true }) resolves to the record itself.
      const created = (await createPackage(
        "service_packages",
        {
          data: {
            org_id: orgId,
            name: draft.name,
            description: draft.description || null,
            category: draft.category,
            suggested_price: draft.suggested_price,
            currency: draft.currency,
            billing_type: draft.billing_type,
            billing_interval: draft.billing_interval,
            active: draft.active,
            sort_order: draft.sort_order,
            booking_enabled: Boolean(draft.booking_enabled),
            ticket_billing_enabled: Boolean(draft.ticket_billing_enabled),
            ticket_pricing_mode: draft.ticket_pricing_mode ?? "flat",
            ticket_billing_slug: draft.ticket_billing_slug?.trim() || null,
          },
        },
        { returnPromise: true },
      )) as ServicePackage;

      if (!created?.id) {
        throw new Error("Catalog item was created but no record was returned");
      }
      return created;
    },
    onSuccess: async (record) => {
      await queryClient.invalidateQueries({ queryKey: ["service_packages"] });
      onChange({
        title: record.name,
        item_detail: record.description?.trim() ?? "",
        unit_price: Number(record.suggested_price) || 0,
        package_id: Number(record.id),
        addon_id: null,
      });
      setQuery(record.name);
      setOpen(false);
      notify("Catalog item created", { type: "success" });
    },
    onError: () => {
      notify("Could not create catalog item", { type: "error" });
    },
  });

  const pick = (item: CatalogSuggestion) => {
    if (lastPickIdRef.current === item.id) return;
    lastPickIdRef.current = item.id;
    pickingRef.current = true;
    onChange({
      title: item.title,
      item_detail: item.item_detail ?? "",
      unit_price: Number(item.unit_price) || 0,
      package_id: item.package_id ?? null,
      addon_id: item.addon_id ?? null,
    });
    onCatalogPick?.({ billing_interval: item.billing_interval ?? null });
    setQuery(item.title);
    setOpen(false);
    window.setTimeout(() => {
      lastPickIdRef.current = null;
    }, 0);
  };

  const handleSuggestionPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    item: CatalogSuggestion,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    pick(item);
  };

  const selectedSuggestionId =
    line.addon_id != null
      ? `addon-${line.addon_id}`
      : line.package_id != null
        ? `pkg-${line.package_id}`
        : null;

  const renderSuggestion = (item: CatalogSuggestion) => {
    const isSelected = selectedSuggestionId === item.id;
    return (
      <li key={item.id}>
        <button
          type="button"
          data-catalog-suggestion={item.id}
          className={cn(
            "flex w-full items-start gap-4 px-4 py-2.5 text-left hover:bg-accent",
            isSelected && "bg-accent",
          )}
          onPointerDown={(event) => handleSuggestionPointerDown(event, item)}
        >
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">
            {item.title}
          </span>
          {item.item_detail ? (
            <span className="mt-0.5 block line-clamp-2 text-xs leading-snug text-muted-foreground">
              {item.item_detail}
            </span>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-foreground">
            {formatSuggestionPrice(item.unit_price)}
          </span>
          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
            {item.kind === "package" ? "Package" : "Add-on"}
          </span>
        </div>
      </button>
    </li>
    );
  };

  const suggestionsMenu =
    open && position
      ? createPortal(
          <ul
            data-invoice-item-suggestions
            className="fixed z-[200] max-h-80 overflow-y-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-xl"
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
            }}
          >
            {hasResults ? (
              <>
                {filteredPackages.length > 0 ? (
                  <>
                    <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Packages
                    </li>
                    {filteredPackages.map(renderSuggestion)}
                  </>
                ) : null}
                {filteredAddons.length > 0 ? (
                  <>
                    <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Add-ons
                    </li>
                    {filteredAddons.map(renderSuggestion)}
                  </>
                ) : null}
              </>
            ) : null}
            {showCreateOption ? (
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-primary hover:bg-accent"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                >
                  {createCatalogMutation.isPending ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                  ) : (
                    <Plus className="size-4 shrink-0" />
                  )}
                  <span>
                    Create{" "}
                    <span className="font-medium">
                      &quot;{trimmedQuery}&quot;
                    </span>{" "}
                    in catalog
                  </span>
                </button>
              </li>
            ) : null}
            {!hasResults && !showCreateOption ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Type to search catalog items
              </li>
            ) : null}
          </ul>,
          document.body,
        )
      : null;

  const nextSortOrder =
    packages.reduce(
      (max, pkg) => Math.max(max, Number(pkg.sort_order) || 0),
      0,
    ) + 1;

  return (
    <>
      <div ref={rootRef} className={cn("space-y-2", className)}>
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            onChange({
              title: next,
              package_id: null,
              addon_id: null,
            });
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search or type item…"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm focus-visible:ring-1 focus-visible:ring-ring"
        />
        {selectedSuggestionId ? (
          <p className="text-xs text-muted-foreground">
            Selected:{" "}
            <span className="font-medium text-foreground">{line.title}</span>
            {" · "}
            {formatSuggestionPrice(Number(line.unit_price) || 0)}
          </p>
        ) : null}
        {suggestionsMenu}
        <Textarea
          value={line.item_detail ?? ""}
          onChange={(event) => onChange({ item_detail: event.target.value })}
          placeholder="Description (optional)"
          rows={Math.max(2, line.item_detail?.split("\n").length ?? 1)}
          className="min-h-[2.75rem] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground shadow-sm focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <ServiceCatalogItemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New catalog item"
        mode="quick"
        sortOrder={nextSortOrder}
        initial={{
          name: trimmedQuery || line.title,
          description: "",
          suggested_price: line.unit_price || 0,
          billing_type:
            billingTypeFilter === "one_time" ? "one_time" : "recurring",
          billing_interval:
            billingTypeFilter === "recurring"
              ? defaultBillingInterval
              : null,
        }}
        onSave={(draft) => createCatalogMutation.mutateAsync(draft)}
      />
    </>
  );
};
