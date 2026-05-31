import { Plus, Trash2 } from "lucide-react";
import { useGetList } from "ra-core";
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
import { Badge } from "@/components/ui/badge";
import type { ServiceAddon, ServicePackage } from "@/lbs/types";
import {
  BILLING_INTERVALS,
  BILLING_TYPES,
} from "@/lbs/proposals/proposalCommercialConstants";
import {
  lineTotal,
  type ProposalLineDraft,
} from "@/lbs/proposals/proposalCommercialUtils";
import { MoneyText } from "@/lib/permissions/MoneyText";

const newLineKey = () => `line-${Date.now()}-${Math.random()}`;

export const ProposalLineItemsEditor = ({
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

  const addPackage = (pkg: ServicePackage) => {
    onChange([
      ...lines,
      {
        key: newLineKey(),
        description: pkg.name,
        quantity: 1,
        unit_price: pkg.suggested_price,
        billing_type: pkg.billing_type,
        billing_interval: pkg.billing_interval ?? null,
        package_id: Number(pkg.id),
        addon_id: null,
        sort_order: lines.length,
      },
    ]);
  };

  const addAddon = (addon: ServiceAddon) => {
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

  const updateLine = (
    key: string,
    patch: Partial<ProposalLineDraft>,
  ) => {
    onChange(
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (key: string) => {
    onChange(lines.filter((line) => line.key !== key));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Line items</CardTitle>
        <div className="flex flex-wrap gap-2">
          {packages.map((pkg) => (
            <Button
              key={String(pkg.id)}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addPackage(pkg)}
            >
              <Plus className="size-3.5" />
              {pkg.name}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {addons.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {addons.map((addon) => (
              <Button
                key={String(addon.id)}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => addAddon(addon)}
              >
                <Plus className="size-3.5" />
                {addon.name}
              </Button>
            ))}
          </div>
        ) : null}

        {lines.map((line) => (
          <div
            key={line.key}
            className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_80px_120px_120px_auto]"
          >
            <div className="space-y-1 md:col-span-1">
              <Label>Description</Label>
              <Input
                value={line.description}
                onChange={(event) =>
                  updateLine(line.key, { description: event.target.value })
                }
                placeholder="Service description"
              />
            </div>
            <div className="space-y-1">
              <Label>Qty</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={line.quantity}
                onChange={(event) =>
                  updateLine(line.key, {
                    quantity: Number(event.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Unit price</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={line.unit_price}
                onChange={(event) =>
                  updateLine(line.key, {
                    unit_price: Number(event.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={line.billing_type}
                onValueChange={(value) =>
                  updateLine(line.key, {
                    billing_type: value as ProposalLineDraft["billing_type"],
                    billing_interval:
                      value === "recurring" ? "monthly" : null,
                  })
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
            <div className="flex items-end justify-between gap-2">
              <div className="space-y-1">
                <Label>Total</Label>
                <p className="text-sm font-medium">
                  <MoneyText value={lineTotal(line.quantity, line.unit_price)} />
                </p>
                {line.billing_type === "recurring" ? (
                  <Badge variant="outline" className="text-[10px]">
                    {line.billing_interval ?? "monthly"}
                  </Badge>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLine(line.key)}
                aria-label="Remove line"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {line.billing_type === "recurring" ? (
              <div className="space-y-1 md:col-span-full md:max-w-xs">
                <Label>Billing interval</Label>
                <Select
                  value={line.billing_interval ?? "monthly"}
                  onValueChange={(value) =>
                    updateLine(line.key, {
                      billing_interval:
                        value as ProposalLineDraft["billing_interval"],
                    })
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
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...lines,
              {
                key: newLineKey(),
                description: "",
                quantity: 1,
                unit_price: 0,
                billing_type: "one_time",
                billing_interval: null,
                sort_order: lines.length,
              },
            ])
          }
        >
          <Plus className="size-4" />
          Custom line
        </Button>
      </CardContent>
    </Card>
  );
};
