import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  useCreate,
  useDelete,
  useGetIdentity,
  useGetList,
  useNotify,
  useUpdate,
} from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { ServiceAddon, ServicePackage } from "@/lbs/types";
import {
  BILLING_INTERVALS,
  BILLING_TYPES,
} from "@/lbs/proposals/proposalCommercialConstants";

const STARTER_PACKAGES: Array<
  Omit<ServicePackage, "id" | "org_id" | "created_at" | "updated_at">
> = [
  {
    name: "Website Starter",
    description: "5-page business website with mobile responsive design",
    suggested_price: 2500,
    billing_type: "one_time",
    billing_interval: null,
    category: "website",
    active: true,
    sort_order: 1,
  },
  {
    name: "Website Pro",
    description: "Custom website with advanced sections and integrations",
    suggested_price: 4500,
    billing_type: "one_time",
    billing_interval: null,
    category: "website",
    active: true,
    sort_order: 2,
  },
  {
    name: "Monthly Maintenance",
    description: "Updates, backups, and minor content changes",
    suggested_price: 150,
    billing_type: "recurring",
    billing_interval: "monthly",
    category: "maintenance",
    active: true,
    sort_order: 10,
  },
];

const STARTER_ADDONS: Array<
  Omit<ServiceAddon, "id" | "org_id" | "created_at" | "updated_at">
> = [
  {
    name: "Logo design",
    description: "Custom logo with 2 revision rounds",
    suggested_price: 400,
    billing_type: "one_time",
    billing_interval: null,
    package_id: null,
    active: true,
    sort_order: 1,
  },
  {
    name: "Google Business Profile setup",
    description: "GBP optimization and verification support",
    suggested_price: 150,
    billing_type: "one_time",
    billing_interval: null,
    package_id: null,
    active: true,
    sort_order: 2,
  },
  {
    name: "SEO monthly",
    description: "On-page SEO and monthly reporting",
    suggested_price: 350,
    billing_type: "recurring",
    billing_interval: "monthly",
    package_id: null,
    active: true,
    sort_order: 3,
  },
];

export const ServiceCatalogSettings = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const orgId = Number(identity?.org_id ?? 1);
  const [createPackage] = useCreate();
  const [updatePackage] = useUpdate();
  const [deletePackage] = useDelete();
  const [createAddon] = useCreate();
  const [updateAddon] = useUpdate();
  const [deleteAddon] = useDelete();

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

  const seedStarter = useMutation({
    mutationFn: async () => {
      for (const pkg of STARTER_PACKAGES) {
        await createPackage(
          "service_packages",
          { data: { ...pkg, org_id: orgId } },
          { returnPromise: true },
        );
      }
      for (const addon of STARTER_ADDONS) {
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
      notify("Starter catalog loaded", { type: "success" });
    },
    onError: () => notify("Failed to load starter catalog", { type: "error" }),
  });

  if (isPackagesPending || isAddonsPending) {
    return <p className="text-sm text-muted-foreground">Loading catalog…</p>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Packages and add-ons appear as quick-add buttons in the proposal
          builder. Suggested prices can be edited per proposal.
        </p>
        {packages.length === 0 && addons.length === 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={seedStarter.isPending}
            onClick={() => seedStarter.mutate()}
          >
            {seedStarter.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Load starter catalog
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Packages</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              createPackage("service_packages", {
                data: {
                  org_id: orgId,
                  name: "New package",
                  suggested_price: 0,
                  billing_type: "one_time",
                  active: true,
                  sort_order: packages.length + 1,
                },
              })
            }
          >
            <Plus className="size-4" />
            Add package
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {packages.map((pkg) => (
            <CatalogRow
              key={String(pkg.id)}
              name={pkg.name}
              description={pkg.description ?? ""}
              suggestedPrice={pkg.suggested_price}
              billingType={pkg.billing_type}
              billingInterval={pkg.billing_interval ?? null}
              active={pkg.active ?? true}
              onSave={(patch) =>
                updatePackage("service_packages", {
                  id: pkg.id,
                  data: patch,
                  previousData: pkg,
                })
              }
              onDelete={() =>
                deletePackage("service_packages", {
                  id: pkg.id,
                  previousData: pkg,
                })
              }
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Add-ons</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              createAddon("service_addons", {
                data: {
                  org_id: orgId,
                  name: "New add-on",
                  suggested_price: 0,
                  billing_type: "one_time",
                  active: true,
                  sort_order: addons.length + 1,
                },
              })
            }
          >
            <Plus className="size-4" />
            Add add-on
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {addons.map((addon) => (
            <CatalogRow
              key={String(addon.id)}
              name={addon.name}
              description={addon.description ?? ""}
              suggestedPrice={addon.suggested_price}
              billingType={addon.billing_type}
              billingInterval={addon.billing_interval ?? null}
              active={addon.active ?? true}
              onSave={(patch) =>
                updateAddon("service_addons", {
                  id: addon.id,
                  data: patch,
                  previousData: addon,
                })
              }
              onDelete={() =>
                deleteAddon("service_addons", {
                  id: addon.id,
                  previousData: addon,
                })
              }
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

const CatalogRow = ({
  name,
  description,
  suggestedPrice,
  billingType,
  billingInterval,
  active,
  onSave,
  onDelete,
}: {
  name: string;
  description: string;
  suggestedPrice: number;
  billingType: "one_time" | "recurring";
  billingInterval: "weekly" | "monthly" | "yearly" | null;
  active: boolean;
  onSave: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) => {
  const [draft, setDraft] = useState({
    name,
    description,
    suggested_price: suggestedPrice,
    billing_type: billingType,
    billing_interval: billingInterval,
    active,
  });

  return (
    <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={draft.name}
          onChange={(event) =>
            setDraft((current) => ({ ...current, name: event.target.value }))
          }
        />
        <Label>Description</Label>
        <Textarea
          value={draft.description}
          rows={2}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Suggested price</Label>
        <Input
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
        <Label>Billing type</Label>
        <Select
          value={draft.billing_type}
          onValueChange={(value) =>
            setDraft((current) => ({
              ...current,
              billing_type: value as "one_time" | "recurring",
              billing_interval: value === "recurring" ? "monthly" : null,
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
        {draft.billing_type === "recurring" ? (
          <>
            <Label>Interval</Label>
            <Select
              value={draft.billing_interval ?? "monthly"}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  billing_interval: value as "weekly" | "monthly" | "yearly",
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
          </>
        ) : null}
        <div className="flex items-center gap-2">
          <Switch
            checked={draft.active}
            onCheckedChange={(checked) =>
              setDraft((current) => ({ ...current, active: checked }))
            }
          />
          <Label>Active</Label>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => onSave(draft)}>
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
