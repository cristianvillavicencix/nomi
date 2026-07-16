import { useMemo } from "react";
import { useGetList, type Identifier } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import { LBS_LEAD_STATUSES_FOR_FILTER } from "@/modules/constants/contactStatus";

const ORPHAN_LEAD_CAP = 100;

const leadStatusFilter = {
  "status@in": `(${LBS_LEAD_STATUSES_FOR_FILTER.map((status) => `"${status}"`).join(",")})`,
};

const buildCompanyIdInFilter = (ids: Identifier[]) =>
  `(${ids.map((id) => String(id)).join(",")})`;

/**
 * Batch-fetch contacts for the visible company page + orphan leads (no company).
 * Prefer one `@in` query over N per-company requests.
 */
export const useCompanyNestedContacts = (
  companyIds: Identifier[],
  options?: { enabled?: boolean; fetchOrphans?: boolean },
) => {
  const enabled = options?.enabled !== false;
  const fetchOrphans = options?.fetchOrphans !== false;
  const idsKey = companyIds.map(String).sort().join(",");

  const nestedFilter = useMemo(() => {
    if (companyIds.length === 0) return null;
    return { "company_id@in": buildCompanyIdInFilter(companyIds) };
  }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- idsKey mirrors companyIds

  const {
    data: nestedContacts = [],
    isPending: nestedPending,
    isFetching: nestedFetching,
  } = useGetList<Contact>(
    "contacts",
    {
      pagination: { page: 1, perPage: Math.max(companyIds.length * 10, 50) },
      sort: { field: "last_name", order: "ASC" },
      filter: nestedFilter ?? {},
    },
    {
      enabled: enabled && companyIds.length > 0 && nestedFilter != null,
      staleTime: 15_000,
    },
  );

  const {
    data: orphanCandidates = [],
    isPending: orphansPending,
    isFetching: orphansFetching,
  } = useGetList<Contact>(
    "contacts",
    {
      pagination: { page: 1, perPage: ORPHAN_LEAD_CAP },
      sort: { field: "last_seen", order: "DESC" },
      filter: {
        ...leadStatusFilter,
        "company_id@is": null,
      },
    },
    {
      enabled: enabled && fetchOrphans,
      staleTime: 15_000,
    },
  );

  const contactsByCompanyId = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const contact of nestedContacts) {
      if (contact.company_id == null) continue;
      const key = String(contact.company_id);
      const list = map.get(key) ?? [];
      list.push(contact);
      map.set(key, list);
    }
    return map;
  }, [nestedContacts]);

  const orphanLeads = useMemo(
    () =>
      orphanCandidates.filter(
        (contact) => contact.company_id == null || contact.company_id === "",
      ),
    [orphanCandidates],
  );

  const orphansTruncated =
    fetchOrphans && orphanCandidates.length >= ORPHAN_LEAD_CAP;

  return {
    contactsByCompanyId,
    orphanLeads,
    orphansTruncated,
    isPending:
      (enabled && companyIds.length > 0 && nestedPending) ||
      (enabled && fetchOrphans && orphansPending),
    isFetching: nestedFetching || orphansFetching,
  };
};

/** Pin primary contact first; dedupe by id. */
export const orderContactsForCompany = (
  contacts: Contact[],
  primaryContactId?: Identifier | null,
): Contact[] => {
  if (contacts.length === 0) return contacts;
  const seen = new Set<string>();
  const unique: Contact[] = [];
  for (const contact of contacts) {
    const key = String(contact.id);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(contact);
  }
  if (primaryContactId == null) return unique;
  const primaryKey = String(primaryContactId);
  const primary = unique.find((c) => String(c.id) === primaryKey);
  if (!primary) return unique;
  return [primary, ...unique.filter((c) => String(c.id) !== primaryKey)];
};
