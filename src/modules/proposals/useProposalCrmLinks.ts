import { useEffect, useMemo, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { useGetList, useGetOne } from "ra-core";
import type { Company, Contact, Deal } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { getContactDisplayName } from "@/modules/messages/messageContactUtils";
import { buildOpenDealsFilter } from "@/modules/deals/openDealFilters";
import { pickPreferredDeal } from "@/modules/proposals/proposalClientSearch";
import { isValidRecordId } from "@/lib/isValidRecordId";

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
  const { dealStages, dealPipelineStatuses } = useConfigurationContext();
  const companyId = watch("company_id");
  const contactId = watch("contact_id");
  const dealId = watch("deal_id");
  const prevCompanyIdRef = useRef(companyId);

  const companyIdEnabled = isValidRecordId(companyId);

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId as Company["id"] },
    { enabled: companyIdEnabled },
  );

  const contactFilter = useMemo(
    () => (companyIdEnabled ? { "company_id@eq": companyId } : emptyListFilter),
    [companyId, companyIdEnabled],
  );

  const dealFilter = useMemo(
    () =>
      companyIdEnabled
        ? buildOpenDealsFilter(dealPipelineStatuses, dealStages, {
            "company_id@eq": companyId,
          })
        : emptyListFilter,
    [companyId, companyIdEnabled, dealPipelineStatuses, dealStages],
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

  const { data: companyDeals = [] } = useGetList<Deal>(
    "deals",
    {
      filter: dealFilter,
      pagination: { page: 1, perPage: 50 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { enabled: companyIdEnabled },
  );

  const { data: selectedDeal } = useGetOne<Deal>(
    "deals",
    { id: dealId as Deal["id"] },
    { enabled: isValidRecordId(dealId) },
  );

  useEffect(() => {
    if (prevCompanyIdRef.current !== companyId) {
      setValue("deal_id", null);
      prevCompanyIdRef.current = companyId;
    }
  }, [companyId, setValue]);

  useEffect(() => {
    if (!companyIdEnabled) return;

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

  useEffect(() => {
    if (!companyIdEnabled) return;

    const dealBelongs = companyDeals.some(
      (row) => String(row.id) === String(dealId),
    );
    if (dealId && dealBelongs) return;

    const preferred = pickPreferredDeal(companyDeals, contactId);
    setValue("deal_id", preferred?.id ?? null);
  }, [companyIdEnabled, companyDeals, contactId, dealId, setValue]);

  return {
    companyIdEnabled,
    contactFilter,
    dealFilter,
    companyContacts,
    company,
    selectedDeal,
  };
};
