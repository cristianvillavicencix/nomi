import { useMemo } from "react";
import { useGetOne } from "ra-core";
import type { Company, Contact, Deal } from "@/components/atomic-crm/types";
import type { SendFormContext } from "@/lbs/forms-v2/share/sendFormTypes";

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

export const useSendFormRecipient = (context: SendFormContext) => {
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: context.contact_id! },
    { enabled: Boolean(context.contact_id) },
  );

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: context.company_id! },
    { enabled: Boolean(context.company_id) && !context.contact_id },
  );

  const { data: primaryContact } = useGetOne<Contact>(
    "contacts",
    { id: company?.primary_contact_id! },
    { enabled: Boolean(company?.primary_contact_id) && !context.contact_id },
  );

  const { data: deal } = useGetOne<Deal>(
    "deals",
    { id: context.deal_id! },
    { enabled: Boolean(context.deal_id) },
  );

  const dealContactId =
    deal?.contact_id ??
    (Array.isArray(deal?.contact_ids) ? deal.contact_ids[0] : undefined);

  const { data: dealContact } = useGetOne<Contact>(
    "contacts",
    { id: dealContactId! },
    { enabled: Boolean(dealContactId) && !context.contact_id },
  );

  return useMemo(() => {
    const resolvedContact = contact ?? dealContact ?? primaryContact ?? null;
    const recipientName =
      context.recipientName ||
      readContactName(resolvedContact) ||
      context.resourceName ||
      "recipient";
    const recipientEmail =
      context.recipientEmail || readContactEmail(resolvedContact);
    const recipientPhone =
      context.recipientPhone || readContactPhone(resolvedContact);

    return {
      contactId:
        context.contact_id ??
        (resolvedContact?.id != null ? Number(resolvedContact.id) : undefined),
      companyId:
        context.company_id ??
        (company?.id != null
          ? Number(company.id)
          : resolvedContact?.company_id != null
            ? Number(resolvedContact.company_id)
            : deal?.company_id != null
              ? Number(deal.company_id)
              : undefined),
      dealId:
        context.deal_id ?? (deal?.id != null ? Number(deal.id) : undefined),
      conversationId: context.conversation_id,
      recipientName,
      recipientEmail,
      recipientPhone,
      dialogTitle:
        context.type === "deal"
          ? `Send a form for ${deal?.name ?? context.resourceName ?? "this project"}`
          : context.type === "standalone"
            ? "Share form link"
            : `Send a form to ${recipientName}`,
    };
  }, [
    company?.id,
    contact,
    context.company_id,
    context.contact_id,
    context.conversation_id,
    context.deal_id,
    context.recipientEmail,
    context.recipientName,
    context.recipientPhone,
    context.resourceName,
    context.type,
    deal?.company_id,
    deal?.id,
    deal?.name,
    dealContact,
    primaryContact,
  ]);
};
