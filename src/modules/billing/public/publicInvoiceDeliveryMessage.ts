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
  lineDescription: string,
  delivery?: PublicInvoiceDeliveryInfo | null,
) => {
  const parts: string[] = [];
  const address = delivery?.property_address?.trim();
  if (address && lineDescription.toLowerCase().includes(address.toLowerCase())) {
    parts.push(address);
  }

  const supplementItem = delivery?.items?.find((item) => item.kind === "supplement");
  if (supplementItem?.line_count != null && supplementItem.line_count > 0) {
    const lineLabel =
      supplementItem.line_count === 1 ? "1 line" : `${supplementItem.line_count} lines`;
    parts.push(lineLabel);
  }

  return parts.length ? parts.join(" · ") : null;
};

export const formatPublicInvoiceLineTitle = (description: string) =>
  description.replace(/^Supplement of /i, "Supplement — ");
