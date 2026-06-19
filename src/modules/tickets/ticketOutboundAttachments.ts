import type { ClientInvoice, Ticket } from "@/modules/types";

export const isTicketAwaitingPayment = (
  ticket: Pick<Ticket, "invoice_id" | "delivery_status">,
) =>
  Boolean(ticket.invoice_id) && ticket.delivery_status === "invoice_sent";

/**
 * True when the initial supplement delivery is tied to an unpaid sent invoice.
 * In that state, billable files must use the Delivery package (auto-sent after payment).
 */
export const isTicketAwaitingPaidDelivery = (
  ticket: Pick<Ticket, "invoice_id" | "delivery_status">,
  invoice?: Pick<ClientInvoice, "status"> | null,
) => {
  if (!ticket.invoice_id) return false;
  if (ticket.delivery_status === "delivered") return false;
  if (invoice?.status === "paid" || invoice?.status === "void") return false;
  return (
    ticket.delivery_status === "invoice_sent" && invoice?.status === "sent"
  );
};

export const canSendTicketOutboundAttachments = (
  ticket: Pick<Ticket, "invoice_id" | "delivery_status">,
  invoice?: Pick<ClientInvoice, "status"> | null,
) => !isTicketAwaitingPaidDelivery(ticket, invoice);

export const TICKET_AWAITING_PAYMENT_ATTACHMENT_MESSAGE =
  "Payment is pending for this supplement. Put billable delivery files in the Delivery package (they send automatically after payment). You can still send text-only replies—or attach files after the client pays or files are delivered.";

export const TICKET_AWAITING_PAYMENT_ATTACHMENT_HINT =
  "Text replies are always allowed. Attachments are limited while payment is pending for the delivery package.";
