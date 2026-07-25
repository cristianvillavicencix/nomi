import type { ClientInvoice, Ticket, TicketDeliverable } from "@/modules/types";

export type TicketInvoiceTabKey = `invoice-${string}` | "new";

export const newInvoiceCycleStorageKey = (ticketId: Ticket["id"]) =>
  `ticket-new-invoice-cycle-${ticketId}`;

export const readNewInvoiceCycleActive = (ticketId: Ticket["id"]) => {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(newInvoiceCycleStorageKey(ticketId)) === "1";
};

export const writeNewInvoiceCycleActive = (
  ticketId: Ticket["id"],
  active: boolean,
) => {
  if (typeof sessionStorage === "undefined") return;
  const key = newInvoiceCycleStorageKey(ticketId);
  if (active) {
    sessionStorage.setItem(key, "1");
  } else {
    sessionStorage.removeItem(key);
  }
};

export const invoiceTabKey = (
  invoiceId: string | number,
): TicketInvoiceTabKey => `invoice-${String(invoiceId)}`;

export const getTicketInvoiceHistoryIds = (
  ticket: Ticket,
  deliverables: TicketDeliverable[],
): string[] => {
  const ids = new Set<string>();
  for (const file of deliverables) {
    if (file.invoiced_invoice_id != null) {
      ids.add(String(file.invoiced_invoice_id));
    }
  }
  if (ticket.invoice_id != null) {
    ids.add(String(ticket.invoice_id));
  }
  return [...ids].sort((a, b) => Number(a) - Number(b));
};

export const shouldUseInvoiceTabs = (
  ticket: Ticket,
  deliverables: TicketDeliverable[],
): boolean => getTicketInvoiceHistoryIds(ticket, deliverables).length > 0;

export const getDeliverablesForInvoice = (
  deliverables: TicketDeliverable[],
  invoiceId: string | number,
): TicketDeliverable[] => {
  const key = String(invoiceId);
  return deliverables.filter(
    (file) => String(file.invoiced_invoice_id) === key,
  );
};

export const formatInvoiceTabLabel = (
  invoice: ClientInvoice | undefined,
  invoiceId: string,
): string => {
  if (invoice?.invoice_number) return invoice.invoice_number;
  return `Invoice #${invoiceId}`;
};

export const getLatestSentPaidInvoiceId = (
  invoiceHistoryIds: string[],
  invoicesById: Map<string, ClientInvoice>,
): string | null => {
  for (const invoiceId of [...invoiceHistoryIds].reverse()) {
    const invoice = invoicesById.get(invoiceId);
    if (invoice?.status === "sent" || invoice?.status === "paid") {
      return invoiceId;
    }
  }
  return null;
};

export const getDraftTicketInvoiceId = (
  ticket: Ticket,
  invoicesById: Map<string, ClientInvoice>,
): string | null => {
  if (!ticket.invoice_id) return null;
  const invoice = invoicesById.get(String(ticket.invoice_id));
  return invoice?.status === "draft" ? String(ticket.invoice_id) : null;
};

export const shouldShowNewInvoiceTab = (
  ticket: Ticket,
  deliverables: TicketDeliverable[],
  invoiceHistoryIds: string[],
  invoicesById: Map<string, ClientInvoice>,
  newCycleActive: boolean,
): boolean => {
  if (invoiceHistoryIds.length === 0) {
    return true;
  }

  if (newCycleActive) return true;

  const draftId = getDraftTicketInvoiceId(ticket, invoicesById);
  if (draftId) return true;

  return deliverables.some((file) => !file.invoiced_invoice_id);
};

export const resolveDefaultInvoiceTab = (
  ticket: Ticket,
  invoiceHistoryIds: string[],
  unbilledCount: number,
  invoicesById: Map<string, ClientInvoice>,
  deliverables: TicketDeliverable[],
  newCycleActive: boolean,
): TicketInvoiceTabKey => {
  if (invoiceHistoryIds.length === 0) {
    return "new";
  }

  if (newCycleActive || unbilledCount > 0) {
    return "new";
  }

  const draftId = getDraftTicketInvoiceId(ticket, invoicesById);
  if (draftId) {
    return "new";
  }

  if (ticket.invoice_id) {
    const current = invoicesById.get(String(ticket.invoice_id));
    if (current) {
      return invoiceTabKey(String(ticket.invoice_id));
    }
  }

  const latestSentPaidId = getLatestSentPaidInvoiceId(
    invoiceHistoryIds,
    invoicesById,
  );
  if (latestSentPaidId) {
    return invoiceTabKey(latestSentPaidId);
  }

  const lastId = invoiceHistoryIds.at(-1);
  return lastId ? invoiceTabKey(lastId) : "new";
};

export const getActiveSentPaidInvoiceId = (
  ticket: Ticket,
  invoiceHistoryIds: string[],
  invoicesById: Map<string, ClientInvoice>,
): string | null => {
  if (ticket.invoice_id) {
    const current = invoicesById.get(String(ticket.invoice_id));
    if (current?.status === "sent" || current?.status === "paid") {
      return String(ticket.invoice_id);
    }
  }

  return getLatestSentPaidInvoiceId(invoiceHistoryIds, invoicesById);
};

export const canStartNewTicketInvoiceCycle = (
  ticket: Ticket,
  invoiceHistoryIds: string[],
  invoicesById: Map<string, ClientInvoice>,
  newCycleActive: boolean,
): boolean => {
  if (newCycleActive) return false;

  const activeId = getActiveSentPaidInvoiceId(
    ticket,
    invoiceHistoryIds,
    invoicesById,
  );
  if (!activeId) return false;

  if (ticket.invoice_id && String(ticket.invoice_id) === activeId) {
    return true;
  }

  return !ticket.invoice_id;
};

export const canDismissNewInvoiceTab = (
  invoiceHistoryIds: string[],
  deliverables: TicketDeliverable[],
  ticket: Ticket,
  invoicesById: Map<string, ClientInvoice>,
  newCycleActive: boolean,
): boolean => {
  if (!newCycleActive || invoiceHistoryIds.length === 0) return false;
  if (deliverables.some((file) => !file.invoiced_invoice_id)) return false;
  if (getDraftTicketInvoiceId(ticket, invoicesById)) return false;
  return true;
};

export const isValidInvoiceTab = (
  tab: string,
  invoiceHistoryIds: string[],
  hasNewTab: boolean,
): boolean => {
  if (tab === "new") return hasNewTab;
  if (!tab.startsWith("invoice-")) return false;
  const id = tab.slice("invoice-".length);
  return invoiceHistoryIds.includes(id);
};
