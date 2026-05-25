import { useGetIdentity } from "ra-core";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";

export function useIsAdminLevel(): boolean {
  const { data: identity } = useGetIdentity();
  if (!identity) return false;

  const access = identity as AccessIdentity;
  if (access.administrator) return true;

  return (
    hasMemberCapability(access, "admin.users.manage") ||
    hasMemberCapability(access, "admin.settings.manage")
  );
}
