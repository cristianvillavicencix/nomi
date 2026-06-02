import { useEffect, useMemo, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { useGetList, useGetOne } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { getContactDisplayName } from "@/lbs/messages/messageContactUtils";

export const proposalContactOptionText = (contact: Contact) =>
  getContactDisplayName(contact);

type ProposalCrmFormValues = {
  company_id: unknown;
  contact_id: unknown;
  deal_id: unknown;
};

const emptyListFilter = { "id@eq": -1 };

export const useProposalCrmLinks = () => {
  const { watch, setValue } = useFormContext<ProposalCrmFormValues>();
  const companyId = watch("company_id");
  const contactId = watch("contact_id");
  const prevCompanyIdRef = useRef(companyId);

  const companyIdEnabled =
    companyId != null && companyId !== "" && companyId !== false;

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId as Company["id"] },
    { enabled: companyIdEnabled },
  );

  const contactFilter = useMemo(
    () =>
      companyIdEnabled
        ? { "company_id@eq": companyId }
        : emptyListFilter,
    [companyId, companyIdEnabled],
  );

  const dealFilter = useMemo(
    () =>
      companyIdEnabled ? { "company_id@eq": companyId } : emptyListFilter,
    [companyId, companyIdEnabled],
  );

  const { data: companyContacts = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: contactFilter,
      pagination: { page: 1, perPage: 100 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: companyIdEnabled },
  );

  useEffect(() => {
    if (prevCompanyIdRef.current !== companyId) {
      setValue("deal_id", null);
      prevCompanyIdRef.current = companyId;
    }
  }, [companyId, setValue]);

  useEffect(() => {
    if (!companyIdEnabled) {
      if (contactId) setValue("contact_id", null);
      return;
    }

    const contactBelongs = companyContacts.some(
      (row) => String(row.id) === String(contactId),
    );
    if (contactId && contactBelongs) return;

    const primaryId = company?.primary_contact_id;
    if (
      primaryId != null &&
      companyContacts.some((row) => String(row.id) === String(primaryId))
    ) {
      setValue("contact_id", primaryId);
      return;
    }

    if (companyContacts.length === 1) {
      setValue("contact_id", companyContacts[0].id);
      return;
    }

    if (contactId && !contactBelongs) {
      setValue("contact_id", null);
    }
  }, [
    companyIdEnabled,
    company?.primary_contact_id,
    companyContacts,
    contactId,
    setValue,
  ]);

  return {
    companyIdEnabled,
    contactFilter,
    dealFilter,
    companyContacts,
  };
};
