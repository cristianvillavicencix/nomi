import type { InvoiceLineDraft } from "@/modules/billing/invoiceLineUtils";
import type { ClientSubscription, ServicePackage } from "@/modules/types";

export type SubscriptionLinePayload = {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  package_id?: number | null;
  addon_id?: number | null;
  item_detail?: string | null;
};

export const emptySubscriptionLine = (): InvoiceLineDraft => ({
  key: crypto.randomUUID(),
  title: "",
  item_detail: "",
  quantity: 1,
  unit: "ea",
  unit_price: 0,
  sort_order: 0,
});

export const subscriptionLineFromServicePackage = (
  pkg: Pick<
    ServicePackage,
    "id" | "name" | "description" | "suggested_price"
  >,
): InvoiceLineDraft => ({
  ...emptySubscriptionLine(),
  title: pkg.name,
  item_detail: pkg.description?.trim() ?? "",
  unit_price: Number(pkg.suggested_price) || 0,
  package_id: Number(pkg.id),
});

export const subscriptionLinesFromRecord = (
  subscription: ClientSubscription,
): InvoiceLineDraft[] => {
  const raw = Array.isArray(subscription.line_items)
    ? subscription.line_items
    : [];

  if (raw.length > 0) {
    return raw.map((row, index) => {
      const record =
        row && typeof row === "object"
          ? (row as Record<string, unknown>)
          : null;
      return {
        key: crypto.randomUUID(),
        title: String(record?.description ?? subscription.name ?? ""),
        item_detail: String(record?.item_detail ?? ""),
        quantity: Number(record?.quantity ?? 1) || 1,
        unit: String(record?.unit ?? "ea"),
        unit_price:
          Number(record?.unit_price ?? subscription.amount) || 0,
        sort_order: index,
        package_id:
          record?.package_id != null ? Number(record.package_id) : null,
        addon_id: record?.addon_id != null ? Number(record.addon_id) : null,
      };
    });
  }

  return [
    {
      ...emptySubscriptionLine(),
      title: subscription.name ?? "",
      unit_price: Number(subscription.amount) || 0,
    },
  ];
};

export const subscriptionLineFromRecord = (
  subscription: ClientSubscription,
): InvoiceLineDraft => subscriptionLinesFromRecord(subscription)[0];

export const subscriptionLinesToPayload = (
  lines: InvoiceLineDraft[],
): SubscriptionLinePayload[] =>
  lines
    .filter((line) => line.title.trim())
    .map((line) => ({
      description: line.title.trim(),
      quantity: Number(line.quantity) || 1,
      unit: line.unit ?? "ea",
      unit_price: Number(line.unit_price) || 0,
      package_id: line.package_id ?? null,
      addon_id: line.addon_id ?? null,
      item_detail: line.item_detail?.trim() || null,
    }));

export const sumSubscriptionLinesAmount = (lines: InvoiceLineDraft[]) =>
  subscriptionLinesToPayload(lines).reduce(
    (sum, line) => sum + line.quantity * line.unit_price,
    0,
  );

export const subscriptionNameFromLines = (lines: InvoiceLineDraft[]) => {
  const first = lines.find((line) => line.title.trim());
  return first?.title.trim() || "Subscription";
};
