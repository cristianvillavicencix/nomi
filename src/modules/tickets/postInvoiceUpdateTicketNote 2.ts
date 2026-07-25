import type { Identifier } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

export const postInvoiceUpdateTicketNote = async (
  dataProvider: CrmDataProvider,
  params: {
    ticketId: Identifier;
    invoiceNumber: string;
    reason: string;
  },
) => {
  await dataProvider.replyTicket({
    ticketId: params.ticketId,
    body: [
      "**Invoice updated**",
      "",
      `- **Invoice:** ${params.invoiceNumber}`,
      `- **Reason:** ${params.reason}`,
      "",
      "Payment link unchanged — client can pay using the same URL already sent.",
    ].join("\n"),
    isInternalNote: true,
  });
};
