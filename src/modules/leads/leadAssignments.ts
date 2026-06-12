import type { Identifier } from "ra-core";

export const normalizeAssignedMemberIds = (value: unknown): number[] => {
  if (value == null || value === "") return [];
  const rows = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      rows
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0),
    ),
  );
};

export const assignedMemberIdsFromContact = (contact: {
  assigned_member_ids?: Identifier[] | null;
  organization_member_id?: Identifier | null;
}) => {
  const fromArray = normalizeAssignedMemberIds(contact.assigned_member_ids);
  if (fromArray.length > 0) return fromArray;
  const legacy = normalizeAssignedMemberIds(contact.organization_member_id);
  return legacy;
};

export const applyLeadAssignmentFields = <
  T extends {
    assigned_member_ids?: unknown;
    organization_member_id?: Identifier | null;
  },
>(
  data: T,
): T & {
  assigned_member_ids: number[];
  organization_member_id: number | null;
} => {
  const assigned_member_ids = normalizeAssignedMemberIds(
    data.assigned_member_ids ?? data.organization_member_id,
  );

  return {
    ...data,
    assigned_member_ids,
    organization_member_id: assigned_member_ids[0] ?? null,
  };
};
