import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useGetList, useUpdate, useDataProvider } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import {
  findContactsByExactEmail,
  normalizeTicketEmail,
} from "@/modules/tickets/ticketContactMatch";
import { TICKET_WORKSPACE_SETTINGS_QUERY_KEY } from "@/modules/settings/tickets/useTicketWorkspaceSettings";
import { DEFAULT_TICKET_WORKSPACE_SETTINGS } from "@/modules/settings/tickets/ticketWorkspaceSettings";

/**
 * When a ticket has a requester email but no linked contact, match CRM contacts
 * by exact email and persist contact_id + company_id on the ticket.
 */
export const useAutoLinkTicketRequester = (ticket: Ticket | undefined) => {
  const [update] = useUpdate();
  const linkedRef = useRef<string | null>(null);
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { data: workspaceData } = useQuery({
    queryKey: TICKET_WORKSPACE_SETTINGS_QUERY_KEY,
    queryFn: () => dataProvider.getTicketWorkspaceSettings(),
    staleTime: 60_000,
  });
  const autoLinkEnabled =
    workspaceData?.workspace.auto_link_contact ??
    DEFAULT_TICKET_WORKSPACE_SETTINGS.auto_link_contact;

  const requesterEmail = normalizeTicketEmail(ticket?.requester_email);
  const shouldSearch =
    autoLinkEnabled &&
    Boolean(ticket?.id) &&
    !ticket?.contact_id &&
    requesterEmail.length > 0;

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
