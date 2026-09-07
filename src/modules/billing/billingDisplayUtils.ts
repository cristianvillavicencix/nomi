import type { ProposalPaymentInstallment } from "@/modules/types";
import { toneBadgeVariant, type Tone } from "@/modules/shared/status";

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const isInstallmentOverdue = (row: ProposalPaymentInstallment) =>
  row.status === "pending" &&
  Boolean(row.due_date) &&
  row.due_date < todayIso();

export const formatBillingDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const installmentStatusLabel = (row: ProposalPaymentInstallment) => {
  if (isInstallmentOverdue(row)) return "Overdue";
  switch (row.status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "requires_action":
      return "Action required";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    case "waived":
      return "Waived";
    default:
      return row.status ?? "—";
  }
};

export const installmentStatusVariant = (row: ProposalPaymentInstallment) => {
  if (isInstallmentOverdue(row)) return "destructive" as const;
  switch (row.status) {
    case "paid":
      return "default" as const;
    case "failed":
    case "requires_action":
      return "destructive" as const;
    case "processing":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

export type InstallmentStatusFilter =
  | "all"
  | "pending"
  | "paid"
  | "overdue"
  | "failed"
  | "requires_action";

export const INSTALLMENT_FILTER_OPTIONS: Array<{
  value: InstallmentStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "requires_action", label: "Action required" },
];

export const buildInstallmentListFilter = (
  statusFilter: InstallmentStatusFilter,
) => {
  if (statusFilter === "all") return {};
  if (statusFilter === "overdue") {
    return {
      "status@eq": "pending",
      "due_date@lt": todayIso(),
    };
  }
  return { "status@eq": statusFilter };
};

export type InvoiceStatusFilter =
  | "all"
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "void";

export const INVOICE_FILTER_OPTIONS: Array<{
  value: InvoiceStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
];

/** List filters for `client_invoices`; "all" excludes void (see Void tab). */
export const buildInvoiceListFilter = (
  statusFilter: InvoiceStatusFilter,
): Record<string, string> => {
  if (statusFilter === "all") {
    return { "status@neq": "void" };
  }
  if (statusFilter === "overdue") {
    return {
      "status@eq": "sent",
      "due_date@lt": todayIso(),
    };
  }
  return { "status@eq": statusFilter };
};

export const isClientInvoiceOverdue = (invoice: {
  status?: string | null;
  due_date?: string | null;
}) =>
  (invoice.status === "sent" || invoice.status === "overdue") &&
  Boolean(invoice.due_date) &&
  invoice.due_date! < todayIso();

/** Counts aligned with `INVOICE_FILTER_OPTIONS` / list status filters. */
export const countInvoicesByStatusFilter = (
  invoices: Array<{
    status?: string | null;
    due_date?: string | null;
  }>,
): Record<InvoiceStatusFilter, number> => {
  const counts: Record<InvoiceStatusFilter, number> = {
    all: 0,
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    void: 0,
  };

  for (const invoice of invoices) {
    const status = invoice.status?.toLowerCase() ?? "";
    if (status === "void") {
      counts.void += 1;
      continue;
    }
    counts.all += 1;
    if (status === "draft") counts.draft += 1;
    else if (status === "paid") counts.paid += 1;
    else if (status === "sent" || status === "overdue") {
      counts.sent += 1;
      if (isClientInvoiceOverdue(invoice)) counts.overdue += 1;
    }
  }

  return counts;
};

export const invoiceStatusLabel = (
  status?: string | null,
  dueDate?: string | null,
) => {
  if (isClientInvoiceOverdue({ status, due_date: dueDate })) return "Overdue";
  return status?.replace(/_/g, " ") ?? "—";
};

export const invoiceStatusTone = (
  status?: string | null,
  dueDate?: string | null,
): Tone => {
  if (isClientInvoiceOverdue({ status, due_date: dueDate })) {
    return "destructive";
  }
  switch (status) {
    case "paid":
      return "success";
    case "sent":
      return "info";
    default:
      return "muted";
  }
};

export const invoiceStatusVariant = (
  status?: string | null,
  dueDate?: string | null,
) => toneBadgeVariant(invoiceStatusTone(status, dueDate));
