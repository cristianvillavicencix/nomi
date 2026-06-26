import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useCreate,
  useDelete,
  useGetIdentity,
  useGetList,
  useNotify,
  useUpdate,
} from "ra-core";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  categoryLabel,
} from "@/modules/catalog/catalogConstants";
import {
  LBS_SERVICE_ADDONS,
  LBS_SERVICE_PACKAGES,
} from "@/modules/catalog/serviceCatalogSeed";
import {
  ServiceCatalogItemDialog,
  type CatalogItemDraft,
} from "@/modules/settings/ServiceCatalogItemDialog";
import type { ServiceAddon, ServicePackage } from "@/modules/types";
import { MoneyText } from "@/lib/permissions/MoneyText";

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
});

const toAddonDraft = (addon: ServiceAddon): Partial<CatalogItemDraft> => ({
  name: addon.name,
  description: addon.description ?? "",
  category: addon.category ?? "web",
  suggested_price: addon.suggested_price,
  currency: addon.currency ?? "USD",
  billing_type: addon.billing_type,
  billing_interval: addon.billing_interval ?? null,
  active: addon.active ?? true,
  sort_order: addon.sort_order ?? 0,
});

export const ServiceCatalogSettings = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const orgId = Number(identity?.org_id ?? 1);
  const [createPackage] = useCreate();
  const [updatePackage] = useUpdate();
  const [createAddon] = useCreate();
  const [updateAddon] = useUpdate();
  const [deleteOne] = useDelete();
  const [deleteTarget, setDeleteTarget] = useState<
    | { resource: "service_packages"; record: ServicePackage }
    | { resource: "service_addons"; record: ServiceAddon }
    | null
  >(null);

  const [packageDialog, setPackageDialog] = useState<
    { mode: "create" } | { mode: "edit"; record: ServicePackage } | null
  >(null);
  const [addonDialog, setAddonDialog] = useState<
    { mode: "create" } | { mode: "edit"; record: ServiceAddon } | null
  >(null);

  const { data: packages = [], isPending: isPackagesPending } =
    useGetList<ServicePackage>("service_packages", {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "sort_order", order: "ASC" },
    });

  const { data: addons = [], isPending: isAddonsPending } =
    useGetList<ServiceAddon>("service_addons", {
      pagination: { page: 1, perPage: 500 },
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
      for (const addon of LBS_SERVICE_ADDONS) {
        await createAddon(
          "service_addons",
          { data: { ...addon, org_id: orgId } },
          { returnPromise: true },
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["service_packages"] });
      await queryClient.invalidateQueries({ queryKey: ["service_addons"] });
      notify("LBS + SKOP catalog loaded", { type: "success" });
    },
    onError: () => notify("Failed to load catalog", { type: "error" }),
  });

  const activePackages = useMemo(
    () => packages.filter((pkg) => pkg.active !== false),
    [packages],
  );
  const activeAddons = useMemo(
    () => addons.filter((addon) => addon.active !== false),
    [addons],
  );

  if (isPackagesPending || isAddonsPending) {
    return <p className="text-sm text-muted-foreground">Loading catalog…</p>;
  }

  const catalogEmpty = packages.length === 0 && addons.length === 0;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          One catalog for proposals, invoices, ticket billing, and Book Now.
          Suggested prices can still be edited per proposal or invoice.
        </p>
        {catalogEmpty ? (
          <Button
            type="button"
            variant="outline"
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

      <Tabs defaultValue="packages">
        <TabsList>
          <TabsTrigger value="packages">
            Packages ({packages.length})
          </TabsTrigger>
          <TabsTrigger value="addons">Add-ons ({addons.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Base packages</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  One package per proposal. {activePackages.length} active.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setPackageDialog({ mode: "create" })}
              >
                <Plus className="size-4" />
                New package
              </Button>
            </CardHeader>
            <CardContent>
              <CatalogTable
                rows={packages}
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
                onDelete={(row) =>
                  setDeleteTarget({ resource: "service_packages", record: row })
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addons" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Add-ons</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Stack on a base package. {activeAddons.length} active.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setAddonDialog({ mode: "create" })}
              >
                <Plus className="size-4" />
                New add-on
              </Button>
            </CardHeader>
            <CardContent>
              <CatalogTable
                rows={addons}
                onToggleActive={(row, active) =>
                  updateAddon("service_addons", {
                    id: row.id,
                    data: { active },
                    previousData: row,
                  })
                }
                onEdit={(row) => setAddonDialog({ mode: "edit", record: row })}
                onDelete={(row) =>
                  setDeleteTarget({ resource: "service_addons", record: row })
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ServiceCatalogItemDialog
        open={packageDialog != null}
        onOpenChange={(open) => !open && setPackageDialog(null)}
        variant="package"
        title={packageDialog?.mode === "edit" ? "Edit package" : "New package"}
        sortOrder={packages.length + 1}
        initial={
          packageDialog?.mode === "edit"
            ? toPackageDraft(packageDialog.record)
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
            notify("Package updated", { type: "success" });
          } else {
            await createPackage(
              "service_packages",
              { data: { ...draft, org_id: orgId } },
              { returnPromise: true },
            );
            notify("Package created", { type: "success" });
          }
        }}
      />

      <ServiceCatalogItemDialog
        open={addonDialog != null}
        onOpenChange={(open) => !open && setAddonDialog(null)}
        variant="addon"
        title={addonDialog?.mode === "edit" ? "Edit add-on" : "New add-on"}
        sortOrder={addons.length + 1}
        initial={
          addonDialog?.mode === "edit"
            ? toAddonDraft(addonDialog.record)
            : undefined
        }
        onSave={async (draft) => {
          if (addonDialog?.mode === "edit") {
            await updateAddon(
              "service_addons",
              {
                id: addonDialog.record.id,
                data: draft,
                previousData: addonDialog.record,
              },
              { returnPromise: true },
            );
            notify("Add-on updated", { type: "success" });
          } else {
            await createAddon(
              "service_addons",
              { data: { ...draft, org_id: orgId, package_id: null } },
              { returnPromise: true },
            );
            notify("Add-on created", { type: "success" });
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
              Delete {deleteTarget?.record.name ?? "item"}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the catalog item. Existing proposals and invoices keep
            their saved line text.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
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
                    deleteTarget.resource,
                    {
                      id: deleteTarget.record.id,
                      previousData: deleteTarget.record,
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

const CatalogTable = <
  T extends {
    id: unknown;
    name: string;
    category?: string | null;
    suggested_price: number;
    billing_type: "one_time" | "recurring";
    billing_interval?: string | null;
    active?: boolean;
    booking_enabled?: boolean;
    ticket_billing_enabled?: boolean;
  },
>({
  rows,
  showUsageBadges = false,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  rows: T[];
  showUsageBadges?: boolean;
  onToggleActive: (row: T, active: boolean) => void;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
}) => {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No items yet.
      </p>
    );
  }

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
                        Proposals
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Proposals
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(row)}
                    aria-label={`Edit ${row.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(row)}
                    aria-label={`Delete ${row.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
