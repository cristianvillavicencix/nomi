import { useGetIdentity, useRecordContext } from "ra-core";

import type { OrganizationMember } from "../types";

export const OrganizationMemberName = ({
  member,
}: {
  member?: OrganizationMember;
}) => {
  const { identity, isPending } = useGetIdentity();
  const memberFromContext = useRecordContext<OrganizationMember>();
  const finalMember = member || memberFromContext;
  if (isPending || !finalMember) return null;
  return finalMember.id === identity?.id
    ? "You"
    : `${finalMember.first_name} ${finalMember.last_name}`;
};
