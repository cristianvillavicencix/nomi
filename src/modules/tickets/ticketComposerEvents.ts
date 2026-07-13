export const TICKET_OPEN_BILLING_EVENT = "nomi:ticket-open-billing";
export const TICKET_FOCUS_DELIVERABLE_UPLOAD_EVENT =
  "nomi:ticket-focus-deliverable-upload";

export type TicketComposerEventDetail = {
  ticketId: number;
  files?: File[];
};

export const dispatchTicketOpenBilling = (ticketId: number) => {
  window.dispatchEvent(
    new CustomEvent<TicketComposerEventDetail>(TICKET_OPEN_BILLING_EVENT, {
      detail: { ticketId },
    }),
  );
};

export const dispatchTicketFocusDeliverableUpload = (
  ticketId: number,
  files?: File[],
) => {
  window.dispatchEvent(
    new CustomEvent<TicketComposerEventDetail>(
      TICKET_FOCUS_DELIVERABLE_UPLOAD_EVENT,
      { detail: { ticketId, files } },
    ),
  );
};
