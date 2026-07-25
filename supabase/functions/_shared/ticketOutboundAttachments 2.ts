/** Mirrors src/modules/tickets/ticketOutboundAttachments.ts */
export const isTicketAwaitingPaidDelivery = (params: {
  invoiceId?: number | null;
  deliveryStatus?: string | null;
  invoiceStatus?: string | null;
}) => {
  if (!params.invoiceId) return false;
  if (params.deliveryStatus === "delivered") return false;
  if (params.invoiceStatus === "paid" || params.invoiceStatus === "void") {
    return false;
  }
  return (
    params.deliveryStatus === "invoice_sent" && params.invoiceStatus === "sent"
  );
};

export const TICKET_AWAITING_PAYMENT_ATTACHMENT_MESSAGE =
  "Payment is pending for this supplement. Put billable delivery files in the Delivery package (they send automatically after payment). You can still send text-only replies—or attach files after the client pays or files are delivered.";
