export type PublicInvoiceDeliveryInfo = {
  file_count: number;
  property_address?: string | null;
  items?: Array<{
    kind?: string | null;
    line_count?: number | null;
    label?: string | null;
  }>;
};

const kindToShortLabel = (kind?: string | null) => {
  switch (kind) {
    case "supplement":
      return "supplement";
    case "roof":
      return "roof measurements";
    case "siding":
      return "siding measurements";
    case "esx":
      return "ESX";
    case "pdf_analysis":
      return "PDF analysis";
    default:
      return kind?.replace(/_/g, " ") ?? "file";
  }
};

export const buildPublicInvoiceDeliveryReadyMessage = (
  delivery: PublicInvoiceDeliveryInfo,
) => {
  const count = Math.max(0, delivery.file_count);
  if (count <= 0) return null;

  const fileWord = count === 1 ? "file" : "files";
  const primary = delivery.items?.[0];
  const kindLabel = kindToShortLabel(primary?.kind);

  if (count === 1 && primary?.kind) {
    return `${count} ${fileWord} (.pdf ${kindLabel}) will be emailed automatically right after payment.`;
  }

  return `${count} ${fileWord} will be emailed automatically right after payment.`;
};

export const formatPublicInvoiceLineSubtext = (
  _lineDescription: string,
  _delivery?: PublicInvoiceDeliveryInfo | null,
) => {
  // Customer-facing pay page: line counts and property address belong in the
  // title/description only — avoid duplicating the address or exposing internal
  // supplement line counts used for staff pricing.
  return null;
};

export const formatPublicInvoiceLineTitle = (description: string) =>
  description.replace(/^Supplement of /i, "Supplement — ");
