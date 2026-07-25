import { useEffect, useMemo } from "react";
import type { Identifier } from "ra-core";
import { useGetList, useGetOne } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import type { Company, Contact, Deal } from "@/components/atomic-crm/types";
import { getContactFullName } from "@/modules/clients/clientShowUtils";
import { CONTACT_STATUS_FILTER } from "@/modules/shared/relatedFilters";
import {
  resolvePrimaryContactId,
} from "@/modules/work/workCreateAccountLinkUtils";

export const useWorkCreateAccountLinkSync = () => {
  const { setValue, getValues } = useFormContext();
  const companyId = useWatch({ name: "company_id" }) as
    | Identifier
    | null
    | undefined;
  const contactId = useWatch({ name: "contact_id" }) as
    | Identifier
    | null
    | undefined;
  const dealId = useWatch({ name: "deal_id" }) as Identifier | null | undefined;

  const { data: companyContacts = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: {
        "company_id@eq": companyId,
        "status@in": CONTACT_STATUS_FILTER,
      },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: Boolean(companyId), staleTime: 30_000 },
  );

  const { data: companyDeals = [] } = useGetList<Deal>(
    "deals",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
    },
    { enabled: Boolean(companyId), staleTime: 30_000 },
  );

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId ?? "" },
    { enabled: Boolean(companyId) },
  );

  const contactChoices = useMemo(
    () =>
      companyContacts.map((contact) => ({
        id: contact.id,
        name: getContactFullName(contact),
      })),
    [companyContacts],
  );

  useEffect(() => {
    if (!companyId) {
      setValue("contact_id", null);
      setValue("deal_id", null);
      return;
    }

    const nextContactId = resolvePrimaryContactId(
      companyId,
      contactId,
      companyContacts,
      company?.primary_contact_id,
    );

    if (String(nextContactId ?? "") !== String(contactId ?? "")) {
      setValue("contact_id", nextContactId, { shouldDirty: true });
    }
  }, [
    companyId,
    contactId,
    companyContacts,
    company?.primary_contact_id,
    setValue,
  ]);

  useEffect(() => {
    if (!companyId) return;

    const currentDealId = getValues("deal_id") as Identifier | null | undefined;
    if (
      currentDealId != null &&
      !companyDeals.some(
        (deal) => String(deal.id) === String(currentDealId),
      )
    ) {
      setValue("deal_id", null, { shouldDirty: true });
      return;
    }

    if (currentDealId == null && companyDeals.length === 1) {
      setValue("deal_id", companyDeals[0].id, { shouldDirty: true });
    }
  }, [companyId, companyDeals, dealId, getValues, setValue]);

  return {
    companyId,
    contactId,
    dealId,
    companyContacts,
    companyDeals,
    company,
    contactChoices,
  };
};

/** Hydrate company_id from linked deal or contact when editing legacy records. */
export const WorkCreateAccountLinkInitializer = () => {
  const { setValue } = useFormContext();
  const companyId = useWatch({ name: "company_id" }) as
    | Identifier
    | null
    | undefined;
  const dealId = useWatch({ name: "deal_id" }) as Identifier | null | undefined;
  const contactId = useWatch({ name: "contact_id" }) as
    | Identifier
    | null
    | undefined;

  const { data: deal } = useGetOne<Deal>(
    "deals",
    { id: dealId! },
    { enabled: dealId != null && !companyId },
  );

  const { data: contact } = useGetOne<Contact>(
    "contacts_summary",
    { id: contactId! },
    { enabled: contactId != null && !companyId && !deal?.company_id },
  );

  useEffect(() => {
    if (companyId) return;

    if (deal?.company_id != null) {
      setValue("company_id", deal.company_id, { shouldDirty: false });
      return;
    }

    if (contact?.company_id != null) {
      setValue("company_id", contact.company_id, { shouldDirty: false });
    }
  }, [companyId, deal?.company_id, contact?.company_id, setValue]);

  return null;
};
