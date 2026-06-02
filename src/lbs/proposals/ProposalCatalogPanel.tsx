import { Check, Plus } from "lucide-react";
import { useGetList } from "ra-core";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ADDON_CATALOG_GROUPS,
  billingIntervalSuffix,
  categoryLabel,
} from "@/lbs/catalog/catalogConstants";
import {
  addonAlreadyInCart,
  findAddonLine,
  isPackageLine,
  newLineKey,
  selectedPackageId,
} from "@/lbs/proposals/proposalCatalogUtils";
import type { ProposalLineDraft } from "@/lbs/proposals/proposalCommercialUtils";
import type { ServiceAddon, ServicePackage } from "@/lbs/types";
import { MoneyText } from "@/lib/permissions/MoneyText";

export const ProposalCatalogPanel = ({
  lines,
  onChange,
}: {
  lines: ProposalLineDraft[];
  onChange: (lines: ProposalLineDraft[]) => void;
}) => {
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

  const activePackageId = selectedPackageId(lines);

  const selectPackage = (pkg: ServicePackage) => {
    const pkgId = Number(pkg.id);
    const withoutPackages = lines.filter((line) => !isPackageLine(line));
    const packageLine: ProposalLineDraft = {
      key: newLineKey(),
      description: pkg.name,
      quantity: 1,
      unit_price: pkg.suggested_price,
      billing_type: pkg.billing_type,
      billing_interval: pkg.billing_interval ?? null,
      package_id: pkgId,
      addon_id: null,
      sort_order: 0,
    };
    const reordered = [packageLine, ...withoutPackages].map((line, index) => ({
      ...line,
      sort_order: index,
    }));
    onChange(reordered);
  };

  const toggleAddon = (addon: ServiceAddon) => {
    const addonId = Number(addon.id);
    const existing = findAddonLine(lines, addonId);
    if (existing) {
      onChange(lines.filter((line) => line.key !== existing.key));
      return;
    }
    onChange([
      ...lines,
      {
        key: newLineKey(),
        description: addon.name,
        quantity: 1,
        unit_price: addon.suggested_price,
        billing_type: addon.billing_type,
        billing_interval: addon.billing_interval ?? null,
        package_id: addon.package_id ? Number(addon.package_id) : null,
        addon_id: addonId,
        sort_order: lines.length,
      },
    ]);
  };

  const groupedAddons = useMemo(
    () =>
      ADDON_CATALOG_GROUPS.map((group) => ({
        ...group,
        items: addons.filter((addon) =>
          (group.categories as readonly string[]).includes(
            addon.category ?? "web",
          ),
        ),
      })).filter((group) => group.items.length > 0),
    [addons],
  );

  return (
    <div className="w-full min-w-0 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Step 1
          </p>
          <CardTitle className="text-base">Choose a base package</CardTitle>
          <p className="text-sm text-muted-foreground">
            One base per proposal. Selecting another replaces the current one.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {packages.map((pkg) => {
              const isSelected = activePackageId === Number(pkg.id);
              return (
                <button
                  key={String(pkg.id)}
                  type="button"
                  onClick={() => selectPackage(pkg)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                    isSelected &&
                      "border-primary bg-primary/5 ring-2 ring-primary",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="secondary"
                      className="text-[10px] uppercase"
                    >
                      {categoryLabel(pkg.category)}
                    </Badge>
                    {isSelected ? (
                      <Check className="size-4 shrink-0 text-primary" />
                    ) : null}
                  </div>
                  <p className="mt-2 font-medium text-sm leading-snug">
                    {pkg.name}
                  </p>
                  {pkg.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {pkg.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm font-semibold tabular-nums">
                    <MoneyText value={pkg.suggested_price} />
                    {billingIntervalSuffix(
                      pkg.billing_type,
                      pkg.billing_interval,
                    )}
                    {pkg.billing_type === "one_time" ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {" "}
                        one-time
                      </span>
                    ) : null}
                  </p>
                </button>
              );
            })}
          </div>
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No packages in catalog. Add them in Settings → Commercial.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Step 2
          </p>
          <CardTitle className="text-base">Add services</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tap + to add. Tap again to remove from the cart.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {groupedAddons.map((group) => (
            <section key={group.key} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.items.map((addon) => {
                  const inCart = addonAlreadyInCart(lines, Number(addon.id));
                  return (
                    <div
                      key={String(addon.id)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border p-3 transition-colors",
                        inCart &&
                          "border-emerald-600/40 bg-emerald-500/5 dark:border-emerald-500/40",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">
                          {addon.name}
                        </p>
                        {addon.description ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {addon.description}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs font-medium tabular-nums text-muted-foreground">
                          <MoneyText value={addon.suggested_price} />
                          {billingIntervalSuffix(
                            addon.billing_type,
                            addon.billing_interval,
                          )}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant={inCart ? "default" : "outline"}
                        className={cn(
                          "shrink-0",
                          inCart &&
                            "bg-emerald-600 hover:bg-emerald-600/90 dark:bg-emerald-600",
                        )}
                        onClick={() => toggleAddon(addon)}
                        aria-label={
                          inCart ? `Remove ${addon.name}` : `Add ${addon.name}`
                        }
                      >
                        {inCart ? (
                          <Check className="size-4" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {groupedAddons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No add-ons in catalog yet.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
