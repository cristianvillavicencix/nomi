import { useGetIdentity } from "ra-core";
import type { AccessIdentity } from "./canAccess";
import { hasMemberCapability } from "./memberModuleAccess";

export const useMemberCapability = (capabilityId: string): boolean => {
  const { data: identity } = useGetIdentity();
  return hasMemberCapability(identity as AccessIdentity | undefined, capabilityId);
};
