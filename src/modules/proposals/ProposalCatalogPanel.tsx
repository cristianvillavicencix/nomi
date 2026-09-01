import { Check, Plus } from "lucide-react";
import { useGetList } from "ra-core";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

import { IconButton } from "@/components/ui/icon-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  billingIntervalSuffix,
  categoryLabel,
} from "@/modules/catalog/catalogConstants";
import {
  newLineKey,
  packageAlreadyInCart,
  findPackageLine,
} from "@/modules/proposals/proposalCatalogUtils";
import type { ProposalLineDraft } from "@/modules/proposals/proposalCommercialUtils";
import type { ServicePackage } from "@/modules/types";
import { MoneyText } from "@/lib/permissions/MoneyText";

const CatalogPackageGrid = ({
  packages,
  lines,
  onToggle,
  emptyMessage,
}: {
  packages: ServicePackage[];
  lines: ProposalLineDraft[];
  onToggle: (pkg: ServicePackage) => void;
  emptyMessage: string;
}) => {
  if (packages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {packages.map((pkg) => {
        const inCart = packageAlreadyInCart(lines, Number(pkg.id));
        return (
          <div
            key={String(pkg.id)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border p-3 transition-colors",
              inCart && "border-success/40 bg-success/5",
            )}
          >
            <div className="min-w-0 flex-1">
              <Badge variant="secondary" className="text-[10px] uppercase">
                {categoryLabel(pkg.category)}
              </Badge>
              <p className="mt-2 text-sm font-medium leading-snug">{pkg.name}</p>
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
              </p>
            </div>
            <IconButton
              variant={inCart ? "primary" : "secondary"}
              className={cn(
                "shrink-0",
                inCart && "bg-success hover:bg-success/90",
              )}
              onClick={() => onToggle(pkg)}
              aria-label={inCart ? `Remove ${pkg.name}` : `Add ${pkg.name}`}
            >
              {inCart ? <Check className="size-4" /> : <Plus className="size-4" />}
            </IconButton>
          </div>
        );
      })}
    </div>
  );
};

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

  const oneTimePackages = useMemo(
    () => packages.filter((pkg) => pkg.billing_type !== "recurring"),
    [packages],
  );
  const recurringPackages = useMemo(
    () => packages.filter((pkg) => pkg.billing_type === "recurring"),
    [packages],
  );

  const togglePackage = (pkg: ServicePackage) => {
    const pkgId = Number(pkg.id);
    const existing = findPackageLine(lines, pkgId);
    if (existing) {
      onChange(lines.filter((line) => line.key !== existing.key));
      return;
    }
    onChange([
      ...lines,
      {
        key: newLineKey(),
        description: pkg.name,
        quantity: 1,
        unit_price: pkg.suggested_price,
        billing_type: pkg.billing_type,
        billing_interval: pkg.billing_interval ?? null,
        package_id: pkgId,
        addon_id: null,
        sort_order: lines.length,
      },
    ]);
  };

  return (
    <div className="w-full min-w-0 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            One-time
          </p>
          <CardTitle className="text-base">Products & project services</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tap + to add lines to the proposal. Tap again to remove.
          </p>
        </CardHeader>
        <CardContent>
          <CatalogPackageGrid
            packages={oneTimePackages}
            lines={lines}
            onToggle={togglePackage}
            emptyMessage="No one-time catalog items. Add them under Billing → Products & services."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Subscriptions
          </p>
          <CardTitle className="text-base">Recurring services</CardTitle>
          <p className="text-sm text-muted-foreground">
            Monthly or recurring lines (maintenance, hosting, marketing retainers).
          </p>
        </CardHeader>
        <CardContent>
          <CatalogPackageGrid
            packages={recurringPackages}
            lines={lines}
            onToggle={togglePackage}
            emptyMessage="No subscription catalog items. Add them under Billing → Products & services."
          />
        </CardContent>
      </Card>
    </div>
  );
};
