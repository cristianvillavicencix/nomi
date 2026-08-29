import { isClientInvoiceOverdue } from "@/modules/billing/billingDisplayUtils";

/** Corner ribbon for invoice cards / document preview (same labels). */
export type InvoiceStatusRibbon = {
  label: string;
  className: string;
};

export const resolveInvoiceStatusRibbon = (invoice: {
  status?: string | null;
  due_date?: string | null;
}): InvoiceStatusRibbon | null => {
  const status = invoice.status?.toLowerCase() ?? "";

  if (isClientInvoiceOverdue(invoice)) {
    return { label: "Overdue", className: "bg-red-600 text-white" };
  }
  if (status === "paid") {
    return { label: "Paid", className: "bg-emerald-600 text-white" };
  }
  if (status === "sent") {
    return { label: "Sent", className: "bg-blue-600 text-white" };
  }
  // Draft / void: badge only — same as invoice document preview.
  return null;
};
