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

  const addAddon = (addon: ServiceAddon) => {
    if (addonAlreadyInCart(lines, Number(addon.id))) return;
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
        addon_id: Number(addon.id),
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
    <Card className="flex h-full min-h-[480px] flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Catalog</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pick one base package, then add services. Suggested prices — edit in
          the summary.
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-0 pt-0">
        <div className="max-h-[min(70vh,720px)] flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Base package
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
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
                          "border-primary bg-primary/5 ring-1 ring-primary",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm leading-snug">
                          {pkg.name}
                        </span>
                        {isSelected ? (
                          <Check className="size-4 shrink-0 text-primary" />
                        ) : null}
                      </div>
                      {pkg.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {pkg.description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {categoryLabel(pkg.category)}
                        </Badge>
                        <span className="text-sm font-semibold tabular-nums">
                          <MoneyText value={pkg.suggested_price} />
                          {billingIntervalSuffix(
                            pkg.billing_type,
                            pkg.billing_interval,
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {packages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No packages in catalog. Add them in Settings → Commercial.
                </p>
              ) : null}
            </section>

            {groupedAddons.map((group) => (
              <section key={group.key} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h3>
                <div className="flex flex-col gap-2">
                  {group.items.map((addon) => {
                    const inCart = addonAlreadyInCart(lines, Number(addon.id));
                    return (
                      <div
                        key={String(addon.id)}
                        className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {addon.name}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            <MoneyText value={addon.suggested_price} />
                            {billingIntervalSuffix(
                              addon.billing_type,
                              addon.billing_interval,
                            )}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={inCart ? "secondary" : "outline"}
                          disabled={inCart}
                          onClick={() => addAddon(addon)}
                        >
                          <Plus className="size-3.5" />
                          {inCart ? "Added" : "Add"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
