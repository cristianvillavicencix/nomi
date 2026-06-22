export type DeliverableBillingKind =
  | "supplement"
  | "roof"
  | "siding"
  | "esx"
  | "pdf_analysis";

export type SupplementPricingInput = {
  itemCount: number;
  hasRoof: boolean;
  hasSiding: boolean;
  hasEsx: boolean;
  hasPdfAnalysis: boolean;
};

export type DeliverableBillingInput = {
  billing_kind?: DeliverableBillingKind | string | null;
  billing_line_count?: number | null;
  title?: string | null;
};

export type SupplementPricingLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

export type SupplementPricingBreakdown = {
  lines: SupplementPricingLine[];
  subtotal: number;
  transferFee: number;
  total: number;
};

export const DELIVERABLE_BILLING_OPTIONS: {
  kind: DeliverableBillingKind;
  label: string;
  needsLineCount: boolean;
  flatPrice?: number;
}[] = [
  { kind: "supplement", label: "Supplement", needsLineCount: true },
  { kind: "roof", label: "Roof measurements", needsLineCount: false, flatPrice: 25 },
  {
    kind: "siding",
    label: "Siding measurements",
    needsLineCount: false,
    flatPrice: 50,
  },
  { kind: "esx", label: "ESX creation", needsLineCount: false, flatPrice: 40 },
  {
    kind: "pdf_analysis",
    label: "PDF analysis",
    needsLineCount: false,
    flatPrice: 10,
  },
];

const BASE_PRICE = 150;
const BASE_INCLUDED_ITEMS = 50;
const EXTRA_ITEM_PRICE = 0.5;
const ROOF_PRICE = 25;
const SIDING_PRICE = 50;
const ESX_PRICE = 40;
const PDF_ANALYSIS_PRICE = 10;
const STRIPE_FIXED_FEE = 0.3;
const STRIPE_PERCENT_FEE = 0.029;

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const normalizePropertyAddress = (subject?: string | null) =>
  subject?.trim() || "Property";

export const calculateSupplementTotalForLineCount = (lineCount: number) => {
  const count = Math.max(0, Math.floor(Number(lineCount) || 0));
  const extraItems = Math.max(0, count - BASE_INCLUDED_ITEMS);
  return roundMoney(BASE_PRICE + extraItems * EXTRA_ITEM_PRICE);
};

const flatPriceForKind = (kind: DeliverableBillingKind) => {
  switch (kind) {
    case "roof":
      return ROOF_PRICE;
    case "siding":
      return SIDING_PRICE;
    case "esx":
      return ESX_PRICE;
    case "pdf_analysis":
      return PDF_ANALYSIS_PRICE;
    default:
      return 0;
  }
};

export const deliverableBillingKindLabel = (kind: DeliverableBillingKind) =>
  DELIVERABLE_BILLING_OPTIONS.find((option) => option.kind === kind)?.label ??
  kind;

export const buildDeliverableLineDescription = (
  kind: DeliverableBillingKind,
  propertyAddress: string,
  _lineCount?: number | null,
): string => {
  const address = normalizePropertyAddress(propertyAddress);

  switch (kind) {
    case "supplement":
      return `Supplement for ${address}`;
    case "roof":
      return `Measurement of roof of ${address}`;
    case "siding":
      return `Measurement of siding of ${address}`;
    case "esx":
      return `ESX creation for ${address}`;
    case "pdf_analysis":
      return `PDF analysis for ${address}`;
    default:
      return `Services for ${address}`;
  }
};

export const buildDeliverablePricingLine = (
  kind: DeliverableBillingKind,
  propertyAddress: string,
  lineCount?: number | null,
): SupplementPricingLine => {
  if (kind === "supplement") {
    const total = calculateSupplementTotalForLineCount(lineCount ?? 0);
    return {
      description: buildDeliverableLineDescription(kind, propertyAddress, lineCount),
      quantity: 1,
      unit: "ea",
      unitPrice: total,
      lineTotal: total,
    };
  }

  const unitPrice = flatPriceForKind(kind);

  return {
    description: buildDeliverableLineDescription(kind, propertyAddress, lineCount),
    quantity: 1,
    unit: "ea",
    unitPrice,
    lineTotal: unitPrice,
  };
};

const finalizePricing = (lines: SupplementPricingLine[]): SupplementPricingBreakdown => {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const total = roundMoney((subtotal + STRIPE_FIXED_FEE) / (1 - STRIPE_PERCENT_FEE));
  const transferFee = roundMoney(total - subtotal);
  return { lines, subtotal, transferFee, total };
};

export const calculatePricingFromDeliverables = (
  deliverables: DeliverableBillingInput[],
  propertyAddress: string,
): SupplementPricingBreakdown => {
  const lines = deliverables
    .filter((item) => item.billing_kind)
    .map((item) =>
      buildDeliverablePricingLine(
        item.billing_kind as DeliverableBillingKind,
        propertyAddress,
        item.billing_line_count,
      ),
    );

  return finalizePricing(lines);
};

export const calculatePricingFromTicketLegacy = (
  input: SupplementPricingInput,
  propertyAddress: string,
): SupplementPricingBreakdown => {
  const address = normalizePropertyAddress(propertyAddress);
  const lines: SupplementPricingLine[] = [];
  const itemCount = Math.max(0, Math.floor(Number(input.itemCount) || 0));

  if (itemCount > 0) {
    lines.push(buildDeliverablePricingLine("supplement", address, itemCount));
  }
  if (input.hasRoof) {
    lines.push(buildDeliverablePricingLine("roof", address));
  }
  if (input.hasSiding) {
    lines.push(buildDeliverablePricingLine("siding", address));
  }
  if (input.hasEsx) {
    lines.push(buildDeliverablePricingLine("esx", address));
  }
  if (input.hasPdfAnalysis) {
    lines.push(buildDeliverablePricingLine("pdf_analysis", address));
  }

  return finalizePricing(lines);
};

export const allDeliverablesHaveBilling = (deliverables: DeliverableBillingInput[]) =>
  deliverables.length > 0 &&
  deliverables.every((item) => Boolean(item.billing_kind));

export const calculateTicketPricing = (
  deliverables: DeliverableBillingInput[],
  ticket: {
    billing_item_count?: number | null;
    billing_has_roof?: boolean | null;
    billing_has_siding?: boolean | null;
    billing_has_esx?: boolean | null;
    billing_has_pdf_analysis?: boolean | null;
  },
  propertyAddress: string,
): SupplementPricingBreakdown => {
  if (allDeliverablesHaveBilling(deliverables)) {
    return calculatePricingFromDeliverables(deliverables, propertyAddress);
  }

  return calculatePricingFromTicketLegacy(
    {
      itemCount: ticket.billing_item_count ?? 0,
      hasRoof: Boolean(ticket.billing_has_roof),
      hasSiding: Boolean(ticket.billing_has_siding),
      hasEsx: Boolean(ticket.billing_has_esx),
      hasPdfAnalysis: Boolean(ticket.billing_has_pdf_analysis),
    },
    propertyAddress,
  );
};

/** @deprecated Use calculateTicketPricing */
export const calculateSupplementPricing = (
  input: SupplementPricingInput,
): SupplementPricingBreakdown =>
  calculatePricingFromTicketLegacy(input, "Property");

/** @deprecated Use calculateTicketPricing */
export const supplementPricingFromTicket = (ticket: {
  billing_item_count?: number | null;
  billing_has_roof?: boolean | null;
  billing_has_siding?: boolean | null;
  billing_has_esx?: boolean | null;
  billing_has_pdf_analysis?: boolean | null;
}) =>
  calculatePricingFromTicketLegacy(
    {
      itemCount: ticket.billing_item_count ?? 0,
      hasRoof: Boolean(ticket.billing_has_roof),
      hasSiding: Boolean(ticket.billing_has_siding),
      hasEsx: Boolean(ticket.billing_has_esx),
      hasPdfAnalysis: Boolean(ticket.billing_has_pdf_analysis),
    },
    "Property",
  );

export const formatSupplementMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

export const deliverableBillingSummary = (
  deliverable: DeliverableBillingInput,
  propertyAddress: string,
) => {
  if (!deliverable.billing_kind) return "Billing not set";
  const line = buildDeliverablePricingLine(
    deliverable.billing_kind as DeliverableBillingKind,
    propertyAddress,
    deliverable.billing_line_count,
  );
  if (deliverable.billing_kind === "supplement") {
    return `${line.description} · ${deliverable.billing_line_count ?? 0} lines · ${formatSupplementMoney(line.lineTotal)}`;
  }
  return `${line.description} · ${formatSupplementMoney(line.lineTotal)}`;
};
