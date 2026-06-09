import { useGetIdentity, useGetOne } from "ra-core";
import type { OrganizationMember } from "@/components/atomic-crm/types";

export const useCurrentOrganizationMember = () => {
  const { identity, isPending: isIdentityPending } = useGetIdentity();
  const memberId = identity?.id;

  const { data: member, isPending: isMemberPending } =
    useGetOne<OrganizationMember>(
      "organization_members",
      { id: memberId! },
      { enabled: memberId != null },
    );

  return {
    identity,
    member,
    memberId: member?.id ?? identity?.id ?? null,
    isPending: isIdentityPending || isMemberPending,
  };
};
