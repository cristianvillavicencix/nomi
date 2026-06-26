import { todayIso } from "@/modules/billing/billingDisplayUtils";
import type { ClientInvoice, Ticket } from "@/modules/types";

export type TicketInvoiceBadgeItem = {
  key: string;
  label: string;
  className: string;
};

const isInvoiceOverdue = (invoice: ClientInvoice) =>
  invoice.status === "sent" &&
  Boolean(invoice.due_date) &&
  invoice.due_date < todayIso();

const isInvoiceScheduled = (invoice: ClientInvoice) =>
  invoice.status === "draft" && Boolean(invoice.scheduled_send_at?.trim());

export const summarizeTicketInvoices = (invoices: ClientInvoice[]) => {
  const summary = {
    paid: 0,
    pending: 0,
    overdue: 0,
    draft: 0,
    scheduled: 0,
    voided: 0,
    total: invoices.length,
  };

  for (const invoice of invoices) {
    switch (invoice.status) {
      case "paid":
        summary.paid += 1;
        break;
      case "void":
        summary.voided += 1;
        break;
      case "draft":
        if (isInvoiceScheduled(invoice)) {
          summary.scheduled += 1;
        } else {
          summary.draft += 1;
        }
        break;
      case "sent":
      case "overdue":
        if (isInvoiceOverdue(invoice) || invoice.status === "overdue") {
          summary.overdue += 1;
        } else {
          summary.pending += 1;
        }
        break;
      default:
        break;
    }
  }

  return summary;
};

const countLabel = (count: number, singular: string, plural: string) =>
  count === 1 ? singular : `${count} ${plural}`;

export const getTicketInvoiceBadges = (
  ticket: Ticket,
  invoices: ClientInvoice[],
): TicketInvoiceBadgeItem[] => {
  if (invoices.length === 0) {
    if (ticket.invoice_id && ticket.delivery_status === "invoice_sent") {
      return [
        {
          key: "awaiting-payment",
          label: "Awaiting payment",
          className:
            "rounded-none border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100",
        },
      ];
    }
    return [];
  }

  const summary = summarizeTicketInvoices(invoices);
  const badges: TicketInvoiceBadgeItem[] = [];

  if (summary.overdue > 0) {
    badges.push({
      key: "overdue",
      label: countLabel(summary.overdue, "Overdue", "overdue"),
      className:
        "rounded-none border-destructive/30 bg-destructive/10 text-destructive",
    });
  }

  if (summary.pending > 0) {
    badges.push({
      key: "pending",
      label: countLabel(
        summary.pending,
        "Awaiting payment",
        "awaiting payment",
      ),
      className:
        "rounded-none border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100",
    });
  }

  if (summary.scheduled > 0) {
    badges.push({
      key: "scheduled",
      label: countLabel(summary.scheduled, "Scheduled", "scheduled"),
      className:
        "rounded-none border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100",
    });
  }

  if (summary.draft > 0) {
    badges.push({
      key: "draft",
      label: countLabel(summary.draft, "Draft", "drafts"),
      className: "rounded-none border-border bg-muted text-muted-foreground",
    });
  }

  if (summary.paid > 0) {
    badges.push({
      key: "paid",
      label: countLabel(summary.paid, "Paid", "paid"),
      className:
        "rounded-none border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100",
    });
  }

  if (
    summary.paid > 0 &&
    summary.pending === 0 &&
    summary.overdue === 0 &&
    ticket.delivery_status === "delivered"
  ) {
    badges.push({
      key: "delivered",
      label: "Delivered",
      className:
        "rounded-none border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100",
    });
  } else if (
    summary.paid > 0 &&
    summary.pending === 0 &&
    summary.overdue === 0 &&
    ticket.delivery_status !== "delivered" &&
    ticket.delivery_status !== "none"
  ) {
    badges.push({
      key: "delivery-pending",
      label: "Pending delivery",
      className:
        "rounded-none border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100",
    });
  }

  return badges.slice(0, 3);
};

export const ticketHasUnpaidInvoice = (
  ticket: Ticket,
  invoices: ClientInvoice[],
) => {
  if (invoices.length > 0) {
    const summary = summarizeTicketInvoices(invoices);
    return summary.pending > 0 || summary.overdue > 0;
  }
  return (
    Boolean(ticket.invoice_id) && ticket.delivery_status === "invoice_sent"
  );
};
