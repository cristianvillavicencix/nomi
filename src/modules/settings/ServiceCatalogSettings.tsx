import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  useCreate,
  useDelete,
  useGetIdentity,
  useGetList,
  useNotify,
  useUpdate,
} from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  billingIntervalSuffix,
  billingTypeLabel,
  catalogFilterOptionsForRows,
  categoryLabel,
  filterCatalogPackages,
  type CatalogListFilterKey,
} from "@/modules/catalog/catalogConstants";
import { LBS_SERVICE_PACKAGES } from "@/modules/catalog/serviceCatalogSeed";
import {
  ServiceCatalogItemDialog,
  type CatalogItemDraft,
} from "@/modules/settings/ServiceCatalogItemDialog";
import type { ServicePackage } from "@/modules/types";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { cn } from "@/lib/utils";

const toPackageDraft = (pkg: ServicePackage): Partial<CatalogItemDraft> => ({
  name: pkg.name,
  description: pkg.description ?? "",
  category: pkg.category ?? "web",
  suggested_price: pkg.suggested_price,
  currency: pkg.currency ?? "USD",
  billing_type: pkg.billing_type,
  billing_interval: pkg.billing_interval ?? null,
  active: pkg.active ?? true,
  sort_order: pkg.sort_order ?? 0,
  booking_enabled: pkg.booking_enabled ?? false,
  ticket_billing_enabled: pkg.ticket_billing_enabled ?? false,
  ticket_pricing_mode: pkg.ticket_pricing_mode ?? "flat",
  ticket_billing_slug: pkg.ticket_billing_slug ?? "",
  default_contract_terms_id:
    pkg.default_contract_terms_id != null
      ? Number(pkg.default_contract_terms_id)
      : null,
});

function CatalogFilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "bg-background hover:bg-muted/60",
    )}
  >
    <span>{label}</span>
    <span
      className={cn(
        "tabular-nums",
        active ? "text-primary-foreground/80" : "text-muted-foreground",
      )}
    >
      {count}
    </span>
  </button>
  );
}

function CatalogFilterBar({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  options,
}: {
  filter: CatalogListFilterKey;
  onFilterChange: (value: CatalogListFilterKey) => void;
  search: string;
  onSearchChange: (value: string) => void;
  options: ReturnType<typeof catalogFilterOptionsForRows>;
}) {
  return (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <CatalogFilterChip
          key={option.key}
          label={option.label}
          count={option.count}
          active={filter === option.key}
          onClick={() => onFilterChange(option.key)}
        />
      ))}
    </div>
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search catalog…"
        className="pl-8"
        aria-label="Search catalog"
      />
    </div>
  </div>
  );
}

function CatalogListPanel({
  rows,
  usageContext = "one_time",
  showUsageBadges = false,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  rows: ServicePackage[];
  usageContext?: "one_time" | "recurring";
  showUsageBadges?: boolean;
  onToggleActive: (row: ServicePackage, active: boolean) => void;
  onEdit: (row: ServicePackage) => void;
  onDelete: (row: ServicePackage) => void;
}) {
  const [filter, setFilter] = useState<CatalogListFilterKey>("all");
  const [search, setSearch] = useState("");

  const filterOptions = useMemo(
    () =>
      catalogFilterOptionsForRows(rows, {
        includeUsageFilters: usageContext === "one_time",
      }),
    [rows, usageContext],
  );

  useEffect(() => {
    if (!filterOptions.some((option) => option.key === filter)) {
      setFilter("all");
    }
  }, [filter, filterOptions]);

  const filteredRows = useMemo(
    () => filterCatalogPackages(rows, filter, search),
    [rows, filter, search],
  );

  const emptyMessage =
    rows.length === 0
      ? undefined
      : filteredRows.length === 0
        ? "No items match this filter."
        : undefined;

  return (
    <div className="space-y-3">
      {rows.length > 0 ? (
        <CatalogFilterBar
          filter={filter}
          onFilterChange={setFilter}
          search={search}
          onSearchChange={setSearch}
          options={filterOptions}
        />
      ) : null}
      <CatalogTable
        rows={filteredRows}
        usageContext={usageContext}
        showUsageBadges={showUsageBadges}
        emptyMessage={emptyMessage}
        onToggleActive={onToggleActive}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

function CatalogTable({
  rows,
  usageContext = "one_time",
  showUsageBadges = false,
  emptyMessage,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  rows: ServicePackage[];
  usageContext?: "one_time" | "recurring";
  showUsageBadges?: boolean;
  emptyMessage?: string;
  onToggleActive: (row: ServicePackage, active: boolean) => void;
  onEdit: (row: ServicePackage) => void;
  onDelete: (row: ServicePackage) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        {emptyMessage ??
          (usageContext === "recurring"
            ? "No subscription items yet. Add recurring services like website maintenance."
            : "No one-time items yet.")}
      </p>
    );
  }

  const defaultUsageLabel =
    usageContext === "recurring" ? "Subscriptions" : "Proposals · Invoices";

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Used in</TableHead>
            <TableHead>Billing</TableHead>
            <TableHead className="text-right">Suggested</TableHead>
            <TableHead className="text-center">Active</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={String(row.id)}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {categoryLabel(row.category)}
              </TableCell>
              <TableCell>
                {showUsageBadges ? (
                  <div className="flex flex-wrap gap-1">
                    {row.ticket_billing_enabled ? (
                      <Badge variant="outline" className="font-normal">
                        Tickets
                      </Badge>
                    ) : null}
                    {row.booking_enabled ? (
                      <Badge variant="outline" className="font-normal">
                        Book now
                      </Badge>
                    ) : null}
                    {!row.ticket_billing_enabled && !row.booking_enabled ? (
                      <span className="text-xs text-muted-foreground">
                        {defaultUsageLabel}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {defaultUsageLabel}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">
                  {billingTypeLabel(row.billing_type)}
                  {billingIntervalSuffix(
                    row.billing_type,
                    row.billing_interval,
                  )}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <MoneyText value={row.suggested_price} />
                {billingIntervalSuffix(row.billing_type, row.billing_interval)}
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={row.active !== false}
                  onCheckedChange={(checked) => onToggleActive(row, checked)}
                  aria-label={`Toggle ${row.name}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-0.5">
                  <IconButton
                    onClick={() => onEdit(row)}
                    aria-label={`Edit ${row.name}`}
                  >
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton
                    onClick={() => onDelete(row)}
                    aria-label={`Delete ${row.name}`}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const ServiceCatalogSettings = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const orgId = Number(identity?.org_id ?? 1);
  const [createPackage] = useCreate();
  const [updatePackage] = useUpdate();
  const [deleteOne] = useDelete();
  const [deleteTarget, setDeleteTarget] = useState<ServicePackage | null>(null);

  const [packageDialog, setPackageDialog] = useState<
    | { mode: "create"; billingType: "one_time" | "recurring" }
    | { mode: "edit"; record: ServicePackage }
    | null
  >(null);

  const { data: packages = [], isPending: isPackagesPending } =
    useGetList<ServicePackage>("service_packages", {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "sort_order", order: "ASC" },
    });

  const seedCatalog = useMutation({
    mutationFn: async () => {
      for (const pkg of LBS_SERVICE_PACKAGES) {
        await createPackage(
          "service_packages",
          { data: { ...pkg, org_id: orgId } },
          { returnPromise: true },
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["service_packages"] });
      notify("LBS + SKOP catalog loaded", { type: "success" });
    },
    onError: () => notify("Failed to load catalog", { type: "error" }),
  });

  const oneTimePackages = useMemo(
    () => packages.filter((pkg) => pkg.billing_type !== "recurring"),
    [packages],
  );
  const recurringPackages = useMemo(
    () => packages.filter((pkg) => pkg.billing_type === "recurring"),
    [packages],
  );
  const activeOneTimePackages = useMemo(
    () => oneTimePackages.filter((pkg) => pkg.active !== false),
    [oneTimePackages],
  );
  const activeRecurringPackages = useMemo(
    () => recurringPackages.filter((pkg) => pkg.active !== false),
    [recurringPackages],
  );

  if (isPackagesPending) {
    return <p className="text-sm text-muted-foreground">Loading catalog…</p>;
  }

  const catalogEmpty = packages.length === 0;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {catalogEmpty ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={seedCatalog.isPending}
            onClick={() => seedCatalog.mutate()}
          >
            {seedCatalog.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Load LBS + SKOP catalog
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="one-time">
        <TabsList>
          <TabsTrigger value="one-time">
            One-time ({oneTimePackages.length})
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            Subscriptions ({recurringPackages.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="one-time" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  One-time products & services
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  For proposals and invoices. {activeOneTimePackages.length}{" "}
                  active.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setPackageDialog({ mode: "create", billingType: "one_time" })
                }
              >
                <Plus className="size-4" />
                New one-time item
              </Button>
            </CardHeader>
            <CardContent>
              <CatalogListPanel
                rows={oneTimePackages}
                usageContext="one_time"
                showUsageBadges
                onToggleActive={(row, active) =>
                  updatePackage("service_packages", {
                    id: row.id,
                    data: { active },
                    previousData: row,
                  })
                }
                onEdit={(row) =>
                  setPackageDialog({ mode: "edit", record: row })
                }
                onDelete={setDeleteTarget}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Subscription services</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Recurring items for subscriptions and contract templates.{" "}
                  {activeRecurringPackages.length} active.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setPackageDialog({ mode: "create", billingType: "recurring" })
                }
              >
                <Plus className="size-4" />
                New subscription item
              </Button>
            </CardHeader>
            <CardContent>
              <CatalogListPanel
                rows={recurringPackages}
                usageContext="recurring"
                showUsageBadges
                onToggleActive={(row, active) =>
                  updatePackage("service_packages", {
                    id: row.id,
                    data: { active },
                    previousData: row,
                  })
                }
                onEdit={(row) =>
                  setPackageDialog({ mode: "edit", record: row })
                }
                onDelete={setDeleteTarget}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ServiceCatalogItemDialog
        open={packageDialog != null}
        onOpenChange={(open) => !open && setPackageDialog(null)}
        variant="package"
        title={
          packageDialog?.mode === "edit"
            ? "Edit catalog item"
            : packageDialog?.billingType === "recurring"
              ? "New subscription item"
              : "New one-time item"
        }
        sortOrder={packages.length + 1}
        initial={
          packageDialog?.mode === "edit"
            ? toPackageDraft(packageDialog.record)
            : packageDialog?.mode === "create"
              ? packageDialog.billingType === "recurring"
                ? {
                    billing_type: "recurring",
                    billing_interval: "monthly",
                  }
                : { billing_type: "one_time", billing_interval: null }
              : undefined
        }
        onSave={async (draft) => {
          if (packageDialog?.mode === "edit") {
            await updatePackage(
              "service_packages",
              {
                id: packageDialog.record.id,
                data: draft,
                previousData: packageDialog.record,
              },
              { returnPromise: true },
            );
            notify("Catalog item updated", { type: "success" });
          } else {
            await createPackage(
              "service_packages",
              { data: { ...draft, org_id: orgId } },
              { returnPromise: true },
            );
            notify("Catalog item created", { type: "success" });
          }
        }}
      />

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {deleteTarget?.name ?? "item"}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the catalog item. Existing proposals and invoices keep
            their saved line text.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteOne(
                    "service_packages",
                    {
                      id: deleteTarget.id,
                      previousData: deleteTarget,
                    },
                    { returnPromise: true },
                  );
                  notify("Catalog item deleted", { type: "success" });
                  setDeleteTarget(null);
                } catch {
                  notify("Could not delete catalog item", { type: "error" });
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
