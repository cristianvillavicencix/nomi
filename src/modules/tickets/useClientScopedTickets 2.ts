import { useMemo } from "react";
import { useGetList, type Identifier } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import {
  collectContactRequesterEmails,
  mergeScopedTickets,
  type ClientTicketScope,
} from "@/modules/tickets/clientTicketScope";

type UseClientScopedTicketsOptions = {
  companyId?: Identifier;
  contactId?: Identifier;
  scope: ClientTicketScope;
};

export const useClientScopedTickets = ({
  companyId,
  contactId,
  scope,
}: UseClientScopedTicketsOptions) => {
  const scopeEnabled =
    scope === "company" ? companyId != null : contactId != null;

  const contactsFilter =
    scope === "company" && companyId != null
      ? { "company_id@eq": companyId }
      : contactId != null
        ? { "id@eq": contactId }
        : { "id@eq": -1 };

  const { data: contacts = [], isPending: contactsPending } =
    useGetList<Contact>(
      "contacts_summary",
      {
        filter: contactsFilter,
        pagination: { page: 1, perPage: 200 },
        sort: { field: "last_seen", order: "DESC" },
      },
      { enabled: scopeEnabled, staleTime: 30_000 },
    );

  const requesterEmails = useMemo(
    () => collectContactRequesterEmails(contacts),
    [contacts],
  );

  const linkedFilter = useMemo(() => {
    const base = { "merged_into_ticket_id@is": null } as Record<string, unknown>;
    if (scope === "company" && companyId != null) {
      base["company_id@eq"] = companyId;
      return base;
    }
    if (scope === "contact" && contactId != null) {
      base["contact_id@eq"] = contactId;
      return base;
    }
    return { "id@eq": -1 };
  }, [companyId, contactId, scope]);

  const { data: linkedTickets = [], isPending: linkedPending } =
    useGetList<Ticket>(
      "tickets",
      {
        filter: linkedFilter,
        pagination: { page: 1, perPage: 200 },
        sort: { field: "updated_at", order: "DESC" },
      },
      { enabled: scopeEnabled, staleTime: 30_000 },
    );

  const emailInFilter = requesterEmails.length
    ? `(${requesterEmails.map((email) => `"${email}"`).join(",")})`
    : null;

  const { data: emailTickets = [], isPending: emailPending } = useGetList<Ticket>(
    "tickets",
    {
      filter: {
        "merged_into_ticket_id@is": null,
        "requester_email@in": emailInFilter!,
      },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { enabled: scopeEnabled && Boolean(emailInFilter), staleTime: 30_000 },
  );

  const tickets = useMemo(
    () =>
      mergeScopedTickets(linkedTickets, emailTickets, {
        scope,
        companyId,
        contactId,
        requesterEmails,
      }),
    [
      contactId,
      companyId,
      emailTickets,
      linkedTickets,
      requesterEmails,
      scope,
    ],
  );

  return {
    tickets,
    contacts,
    isPending: contactsPending || linkedPending || emailPending,
  };
};
