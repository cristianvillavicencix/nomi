import type { Identifier } from "ra-core";
import type { Company, Contact, Deal } from "@/components/atomic-crm/types";
import { LBS_LEAD_STATUSES_FOR_FILTER } from "@/app/navigation";
import { getContactFullName } from "@/modules/clients/clientShowUtils";
import { isLeadLifecycleStatus } from "@/modules/constants/contactStatus";
import { getLeadStageDef } from "@/modules/leads/leadStages";
import { statusInFilter } from "@/modules/shared/relatedFilters";

export const PROPOSAL_LEAD_SEARCH_FILTER = {
  "status@in": statusInFilter(LBS_LEAD_STATUSES_FOR_FILTER),
};

const dealMatchesContact = (deal: Deal, contactId: unknown) => {
  if (contactId == null || contactId === "") return false;
  const id = String(contactId);
  if (deal.contact_id != null && String(deal.contact_id) === id) return true;
  return deal.contact_ids?.some((rowId) => String(rowId) === id) ?? false;
};

export const pickPreferredDeal = (
  deals: Deal[],
  contactId?: unknown,
): Deal | null => {
  if (deals.length === 0) return null;
  if (contactId != null && contactId !== "") {
    const linked = deals.find((deal) => dealMatchesContact(deal, contactId));
    if (linked) return linked;
  }
  return deals[0] ?? null;
};

export const proposalClientSearchLabel = ({
  company,
  contact,
}: {
  company?: Company | null;
  contact?: Contact | null;
}) => {
  if (company?.name?.trim()) return company.name.trim();
  if (contact) {
    const name = getContactFullName(contact);
    if (name !== "—") return name;
  }
  return "Client";
};

export const proposalClientSearchSubtitle = ({
  company,
  contact,
  deal,
}: {
  company?: Company | null;
  contact?: Contact | null;
  deal?: Deal | null;
}) => {
  const parts: string[] = [];

  if (contact && isLeadLifecycleStatus(contact.status)) {
    const stage = contact.lead_stage
      ? getLeadStageDef(contact.lead_stage).label
      : "Lead";
    parts.push(`Lead · ${stage}`);
  } else if (contact && company) {
    const name = getContactFullName(contact);
    if (name !== "—") parts.push(name);
  }

  if (deal?.name?.trim()) {
    parts.push(deal.name.trim());
  }

  return parts.join(" · ") || undefined;
};

export const applyProposalCompanySelection = (
  company: Company,
  setValue: (
    name: "company_id" | "contact_id" | "deal_id",
    value: Identifier | null,
  ) => void,
) => {
  setValue("company_id", company.id);
  setValue(
    "contact_id",
    company.primary_contact_id != null ? company.primary_contact_id : null,
  );
  setValue("deal_id", null);
};

export const applyProposalContactSelection = (
  contact: Contact,
  setValue: (
    name: "company_id" | "contact_id" | "deal_id",
    value: Identifier | null,
  ) => void,
) => {
  setValue("contact_id", contact.id);
  setValue(
    "company_id",
    contact.company_id != null ? contact.company_id : null,
  );
  setValue("deal_id", null);
};

export const clearProposalClientSelection = (
  setValue: (
    name: "company_id" | "contact_id" | "deal_id",
    value: Identifier | null,
  ) => void,
) => {
  setValue("company_id", null);
  setValue("contact_id", null);
  setValue("deal_id", null);
};
