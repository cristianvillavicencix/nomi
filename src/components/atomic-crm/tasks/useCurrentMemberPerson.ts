import { useGetIdentity, useGetList, useGetOne } from "ra-core";
import type { OrganizationMember, Person } from "@/components/atomic-crm/types";

export const useCurrentMemberPerson = () => {
  const { identity, isPending: isIdentityPending } = useGetIdentity();
  const memberId = identity?.id;

  const { data: member, isPending: isMemberPending } =
    useGetOne<OrganizationMember>(
      "organization_members",
      { id: memberId! },
      { enabled: memberId != null },
    );

  const normalizedEmail = member?.email?.trim().toLowerCase();

  const { data: people = [], isPending: isPeoplePending } = useGetList<Person>(
    "people",
    {
      filter: normalizedEmail ? { "email@eq": normalizedEmail } : {},
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: Boolean(normalizedEmail) },
  );

  return {
    identity,
    member,
    person: people[0] ?? null,
    personId: people[0]?.id ?? null,
    isPending: isIdentityPending || isMemberPending || isPeoplePending,
  };
};
