import { Plus, Trash2 } from "lucide-react";
import { useGetList } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ServiceAddon, ServicePackage } from "@/lbs/types";
import {
  invoiceLineTotal,
  newInvoiceLineKey,
  type InvoiceLineDraft,
} from "@/lbs/billing/invoiceLineUtils";
import { MoneyText } from "@/lib/permissions/MoneyText";

export const InvoiceLineItemsSection = ({
  lines,
  onChange,
}: {
  lines: InvoiceLineDraft[];
  onChange: (lines: InvoiceLineDraft[]) => void;
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
        key: newInvoiceLineKey(),
        description: pkg.name,
        quantity: 1,
        unit: "ea",
        unit_price: pkg.suggested_price,
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
        key: newInvoiceLineKey(),
        description: addon.name,
        quantity: 1,
        unit: "ea",
        unit_price: addon.suggested_price,
        package_id: addon.package_id ? Number(addon.package_id) : null,
        addon_id: Number(addon.id),
        sort_order: lines.length,
      },
    ]);
  };

  const addBlankLine = () => {
    onChange([
      ...lines,
      {
        key: newInvoiceLineKey(),
        description: "",
        quantity: 1,
        unit: "ea",
        unit_price: 0,
        sort_order: lines.length,
      },
    ]);
  };

  const updateLine = (key: string, patch: Partial<InvoiceLineDraft>) => {
    onChange(
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (key: string) => {
    onChange(lines.filter((line) => line.key !== key));
  };

  return (
    <div className="space-y-4">
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
        <Button type="button" variant="ghost" size="sm" onClick={addBlankLine}>
          <Plus className="size-3.5" />
          Custom line
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add packages, add-ons, or a custom line item.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Item & description</th>
                <th className="px-3 py-2 font-medium w-24">Qty</th>
                <th className="px-3 py-2 font-medium w-20">Unit</th>
                <th className="px-3 py-2 font-medium w-28 text-right">Rate</th>
                <th className="px-3 py-2 font-medium w-28 text-right">Amount</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.key} className="border-b last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-2">
                    <Input
                      value={line.description}
                      onChange={(event) =>
                        updateLine(line.key, { description: event.target.value })
                      }
                      placeholder="Description"
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, {
                          quantity: Number(event.target.value) || 0,
                        })
                      }
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={line.unit}
                      onChange={(event) =>
                        updateLine(line.key, { unit: event.target.value })
                      }
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unit_price}
                      onChange={(event) =>
                        updateLine(line.key, {
                          unit_price: Number(event.target.value) || 0,
                        })
                      }
                      className="h-8 text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    <MoneyText
                      value={invoiceLineTotal(line.quantity, line.unit_price)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => removeLine(line.key)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
