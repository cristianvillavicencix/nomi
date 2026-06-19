export type SupplementPricingInput = {
  itemCount: number;
  hasRoof: boolean;
  hasSiding: boolean;
  hasEsx: boolean;
  hasPdfAnalysis: boolean;
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

export const calculateSupplementPricing = (
  input: SupplementPricingInput,
): SupplementPricingBreakdown => {
  const itemCount = Math.max(0, Math.floor(Number(input.itemCount) || 0));
  const extraItems = Math.max(0, itemCount - BASE_INCLUDED_ITEMS);
  const lines: SupplementPricingLine[] = [
    {
      description: "Supplement base (includes up to 50 items)",
      quantity: 1,
      unit: "ea",
      unitPrice: BASE_PRICE,
      lineTotal: BASE_PRICE,
    },
  ];

  if (extraItems > 0) {
    lines.push({
      description: `Extra items (${BASE_INCLUDED_ITEMS + 1}+)`,
      quantity: extraItems,
      unit: "ea",
      unitPrice: EXTRA_ITEM_PRICE,
      lineTotal: roundMoney(extraItems * EXTRA_ITEM_PRICE),
    });
  }

  if (input.hasRoof) {
    lines.push({
      description: "Roof measurements",
      quantity: 1,
      unit: "ea",
      unitPrice: ROOF_PRICE,
      lineTotal: ROOF_PRICE,
    });
  }

  if (input.hasSiding) {
    lines.push({
      description: "Siding / complete measurements",
      quantity: 1,
      unit: "ea",
      unitPrice: SIDING_PRICE,
      lineTotal: SIDING_PRICE,
    });
  }

  if (input.hasEsx) {
    lines.push({
      description: "ESX creation",
      quantity: 1,
      unit: "ea",
      unitPrice: ESX_PRICE,
      lineTotal: ESX_PRICE,
    });
  }

  if (input.hasPdfAnalysis) {
    lines.push({
      description: "PDF analysis",
      quantity: 1,
      unit: "ea",
      unitPrice: PDF_ANALYSIS_PRICE,
      lineTotal: PDF_ANALYSIS_PRICE,
    });
  }

  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const total = roundMoney((subtotal + STRIPE_FIXED_FEE) / (1 - STRIPE_PERCENT_FEE));
  const transferFee = roundMoney(total - subtotal);

  return { lines, subtotal, transferFee, total };
};

export const supplementPricingFromTicket = (ticket: {
  billing_item_count?: number | null;
  billing_has_roof?: boolean | null;
  billing_has_siding?: boolean | null;
  billing_has_esx?: boolean | null;
  billing_has_pdf_analysis?: boolean | null;
}) =>
  calculateSupplementPricing({
    itemCount: ticket.billing_item_count ?? 0,
    hasRoof: Boolean(ticket.billing_has_roof),
    hasSiding: Boolean(ticket.billing_has_siding),
    hasEsx: Boolean(ticket.billing_has_esx),
    hasPdfAnalysis: Boolean(ticket.billing_has_pdf_analysis),
  });

export const formatSupplementMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
