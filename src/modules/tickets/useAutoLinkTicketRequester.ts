import { useEffect, useRef } from "react";
import { useGetList, useUpdate } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import {
  findContactsByExactEmail,
  normalizeTicketEmail,
} from "@/modules/tickets/ticketContactMatch";

/**
 * When a ticket has a requester email but no linked contact, match CRM contacts
 * by exact email and persist contact_id + company_id on the ticket.
 */
export const useAutoLinkTicketRequester = (ticket: Ticket | undefined) => {
  const [update] = useUpdate();
  const linkedRef = useRef<string | null>(null);

  const requesterEmail = normalizeTicketEmail(ticket?.requester_email);
  const shouldSearch =
    Boolean(ticket?.id) && !ticket?.contact_id && requesterEmail.length > 0;

  const { data: emailSearchResults = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: { q: requesterEmail },
      pagination: { page: 1, perPage: 25 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: shouldSearch, staleTime: 30_000 },
  );

  useEffect(() => {
    if (!ticket?.id || ticket.contact_id || !requesterEmail) return;
    if (linkedRef.current === String(ticket.id)) return;

    const matches = findContactsByExactEmail(
      emailSearchResults,
      requesterEmail,
    );
    if (matches.length !== 1) return;

    const contact = matches[0];
    linkedRef.current = String(ticket.id);

    update(
      "tickets",
      {
        id: ticket.id,
        data: {
          contact_id: contact.id,
          company_id: contact.company_id ?? null,
        },
        previousData: ticket,
      },
      {
        onError: () => {
          linkedRef.current = null;
        },
      },
    );
  }, [ticket, requesterEmail, emailSearchResults, update]);
};
