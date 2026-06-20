import { useMemo } from "react";
import { useGetOne } from "ra-core";
import {
  getContactEmail,
  getContactPhone,
} from "@/modules/clients/clientShowUtils";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { LbsDeal } from "@/modules/types";
import {
  syncBriefApprovalsForCompleteSections,
  type WebsiteBriefWithApprovals,
} from "@/modules/deals/websiteBriefSchema";

export const optionalBriefUrl = (url?: string) => {
  if (!url?.trim()) return;
  const urlRegex =
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,}(:[0-9]{1,5})?(\/.*)?$/i;
  if (!urlRegex.test(url.trim())) {
    return "Must be a valid URL";
  }
};

export const buildPrefilledBriefRecord = (
  record: LbsDeal,
  contact?: Contact | null,
  company?: Company | null,
): LbsDeal => {
  const currentBrief: Record<string, unknown> = {
    ...((record.website_brief as Record<string, unknown> | undefined) ?? {}),
  };
  const fillIfEmpty = (key: string, value: string | undefined | null) => {
    if (value == null || value === "") return;
    const existing = currentBrief[key];
    if (existing != null && String(existing).trim().length > 0) return;
    currentBrief[key] = value;
  };

  if (contact) {
    fillIfEmpty("contact_first_name", contact.first_name);
    fillIfEmpty("contact_last_name", contact.last_name);
    if (!contact.first_name && !contact.last_name) {
      const legacy = String(currentBrief.contact_name ?? "").trim();
      if (legacy) {
        const [first, ...rest] = legacy.split(/\s+/);
        fillIfEmpty("contact_first_name", first);
        fillIfEmpty("contact_last_name", rest.join(" "));
      }
    }
    fillIfEmpty("contact_email", getContactEmail(contact));
    fillIfEmpty("contact_phone", getContactPhone(contact));
  }

  if (company) {
    fillIfEmpty("company_name", company.name);
    fillIfEmpty("existing_website", company.website);
    const fullAddress = [
      company.address,
      company.city,
      company.state_abbr,
      company.zipcode,
    ]
      .filter(Boolean)
      .join(", ");
    fillIfEmpty("full_address", fullAddress);
    fillIfEmpty("full_address_street", company.address ?? "");
    fillIfEmpty("full_address_city", company.city ?? "");
    fillIfEmpty("full_address_state", company.state_abbr ?? "");
    fillIfEmpty("full_address_zip", company.zipcode ?? "");
  }

  return { ...record, website_brief: currentBrief };
};

export const useBriefPrefilledRecord = (
  record: LbsDeal,
  enabled = true,
): LbsDeal => {
  const contactId =
    record.contact_id ??
    (Array.isArray(record.contact_ids) ? record.contact_ids[0] : null);

  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId as number },
    { enabled: enabled && contactId != null },
  );
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: record.company_id as number },
    { enabled: enabled && record.company_id != null },
  );

  return useMemo(
    () => buildPrefilledBriefRecord(record, contact, company),
    [record, contact, company],
  );
};

export const mergeBriefSubmitData = (
  record: LbsDeal,
  submitted: LbsDeal,
  memberId: number | null,
): Partial<LbsDeal> => {
  const rawBrief = {
    ...((record.website_brief as Record<string, unknown> | undefined) ?? {}),
    ...((submitted.website_brief as Record<string, unknown> | undefined) ??
      {}),
  } as WebsiteBriefWithApprovals;

  const website_brief = syncBriefApprovalsForCompleteSections(
    rawBrief,
    submitted.project_type ?? record.project_type,
    memberId,
  );

  return {
    project_type: submitted.project_type ?? record.project_type,
    expected_end_date:
      submitted.expected_end_date ?? record.expected_end_date,
    website_brief,
  };
};
