export type TicketCatalogPackage = {
  id?: number | string;
  name: string;
  description?: string | null;
  suggested_price: number;
  ticket_billing_slug?: string | null;
  ticket_pricing_mode?: "flat" | "supplement_lines" | null;
  active?: boolean | null;
  sort_order?: number | null;
};

export type TicketCatalogBillingInput = {
  billing_kind?: string | null;
  billing_line_count?: number | null;
  service_package_id?: number | string | null;
  title?: string | null;
};

export type TicketCatalogPricingLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

const SUPPLEMENT_INCLUDED_LINES = 50;
const SUPPLEMENT_EXTRA_LINE_PRICE = 0.5;

export const slugifyTicketBillingSlug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

export const normalizePropertyAddress = (subject?: string | null) =>
  subject?.trim() || "Property";

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const calculateSupplementTotalForLineCount = (
  lineCount: number,
  basePrice = 150,
) => {
  const count = Math.max(0, Math.floor(Number(lineCount) || 0));
  const extraItems = Math.max(0, count - SUPPLEMENT_INCLUDED_LINES);
  return roundMoney(basePrice + extraItems * SUPPLEMENT_EXTRA_LINE_PRICE);
};

export const isTicketCatalogPackage = (pkg: TicketCatalogPackage): boolean =>
  pkg.active !== false;

export const listTicketBillingPackages = (packages: TicketCatalogPackage[]) =>
  packages
    .filter((pkg) => isTicketCatalogPackage(pkg))
    .sort(
      (left, right) =>
        (left.sort_order ?? 0) - (right.sort_order ?? 0) ||
        left.name.localeCompare(right.name),
    );

export const resolveTicketCatalogPackage = (
  input: TicketCatalogBillingInput,
  packages: TicketCatalogPackage[],
): TicketCatalogPackage | null => {
  if (input.service_package_id != null) {
    const byId = packages.find(
      (pkg) => String(pkg.id) === String(input.service_package_id),
    );
    if (byId) return byId;
  }

  const slug = input.billing_kind?.trim();
  if (!slug) return null;

  return (
    packages.find((pkg) => pkg.ticket_billing_slug === slug) ??
    packages.find((pkg) => slugifyTicketBillingSlug(pkg.name) === slug) ??
    null
  );
};

export const buildTicketCatalogLineDescription = (
  pkg: TicketCatalogPackage,
  propertyAddress: string,
) => {
  const address = normalizePropertyAddress(propertyAddress);
  return `${pkg.name} for ${address}`;
};

export const buildTicketCatalogPricingLine = (
  input: TicketCatalogBillingInput,
  propertyAddress: string,
  packages: TicketCatalogPackage[],
): TicketCatalogPricingLine | null => {
  const pkg = resolveTicketCatalogPackage(input, packages);
  if (!pkg) return null;

  const description = buildTicketCatalogLineDescription(pkg, propertyAddress);

  if (pkg.ticket_pricing_mode === "supplement_lines") {
    const total = calculateSupplementTotalForLineCount(
      input.billing_line_count ?? 0,
      Number(pkg.suggested_price) || 0,
    );
    return {
      description,
      quantity: 1,
      unit: "ea",
      unitPrice: total,
      lineTotal: total,
    };
  }

  const unitPrice = roundMoney(Number(pkg.suggested_price) || 0);
  return {
    description,
    quantity: 1,
    unit: "ea",
    unitPrice,
    lineTotal: unitPrice,
  };
};
