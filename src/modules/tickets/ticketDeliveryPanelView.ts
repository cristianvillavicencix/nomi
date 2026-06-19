import type { ClientInvoice } from "@/modules/types";

export type TicketDeliveryPanelView = "empty" | "building" | "sent_paid";

/**
 * Invoice state: `ticket.invoice_id` → `client_invoices.status`
 * Package: `ticket_deliverables.ticket_id`
 * Invoice link: `client_invoices.ticket_id` + `tickets.invoice_id`
 */
export const getTicketDeliveryPanelView = (
  deliverableCount: number,
  invoice?: ClientInvoice | null,
): TicketDeliveryPanelView => {
  if (deliverableCount === 0) return "empty";
  if (invoice?.status === "sent" || invoice?.status === "paid") {
    return "sent_paid";
  }
  return "building";
};
