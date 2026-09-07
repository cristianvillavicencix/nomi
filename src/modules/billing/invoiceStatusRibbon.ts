import { isClientInvoiceOverdue } from "@/modules/billing/billingDisplayUtils";
import { toneClass, type Tone } from "@/modules/shared/status";

/** Corner ribbon for invoice cards / document preview (same labels). */
export type InvoiceStatusRibbon = {
  label: string;
  tone: Tone;
  className: string;
};

export const resolveInvoiceStatusRibbon = (invoice: {
  status?: string | null;
  due_date?: string | null;
}): InvoiceStatusRibbon | null => {
  const status = invoice.status?.toLowerCase() ?? "";

  const ribbon = (label: string, tone: Tone): InvoiceStatusRibbon => ({
    label,
    tone,
    className: toneClass(tone, "solid"),
  });

  if (isClientInvoiceOverdue(invoice)) {
    return ribbon("Overdue", "destructive");
  }
  if (status === "paid") {
    return ribbon("Paid", "success");
  }
  if (status === "sent") {
    return ribbon("Sent", "info");
  }
  // Draft / void: badge only — same as invoice document preview.
  return null;
};
