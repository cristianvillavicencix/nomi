import { useMemo } from "react";
import { useGetOne } from "ra-core";
import type { Company, Contact, Deal } from "@/components/atomic-crm/types";
import type { Proposal } from "@/lbs/types";

const readContactEmail = (contact?: Contact | null) =>
  contact?.email_jsonb?.find((entry) => entry.email?.trim())?.email?.trim() ??
  "";

const readContactPhone = (contact?: Contact | null) =>
  contact?.phone_jsonb?.find((entry) => entry.number?.trim())?.number?.trim() ??
  "";

const readContactName = (contact?: Contact | null) =>
  contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : "";

export const useProposalRecipient = (proposal: Proposal) => {
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: proposal.contact_id! },
    { enabled: proposal.contact_id != null },
  );

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: proposal.company_id! },
    { enabled: proposal.company_id != null && proposal.contact_id == null },
  );

  const primaryContactId = company?.primary_contact_id;

  const { data: primaryContact } = useGetOne<Contact>(
    "contacts",
    { id: primaryContactId ?? "" },
    {
      enabled: primaryContactId != null && proposal.contact_id == null,
    },
  );

  const { data: deal } = useGetOne<Deal>(
    "deals",
    { id: proposal.deal_id! },
    { enabled: proposal.deal_id != null },
  );

  const dealContactId =
    deal?.contact_id ??
    (Array.isArray(deal?.contact_ids) ? deal.contact_ids[0] : undefined);

  const { data: dealContact } = useGetOne<Contact>(
    "contacts",
    { id: dealContactId ?? "" },
    {
      enabled:
        dealContactId != null &&
        proposal.contact_id == null &&
        primaryContactId == null,
    },
  );

  return useMemo(() => {
    const resolvedContact = contact ?? dealContact ?? primaryContact ?? null;

    return {
      contactId:
        proposal.contact_id != null
          ? Number(proposal.contact_id)
          : resolvedContact?.id != null
            ? Number(resolvedContact.id)
            : undefined,
      dealId:
        proposal.deal_id != null
          ? Number(proposal.deal_id)
          : deal?.id != null
            ? Number(deal.id)
            : undefined,
      recipientName: readContactName(resolvedContact) || "there",
      recipientEmail: readContactEmail(resolvedContact),
      recipientPhone: readContactPhone(resolvedContact),
      contact: resolvedContact,
    };
  }, [contact, deal?.id, dealContact, primaryContact, proposal.contact_id, proposal.deal_id]);
};
