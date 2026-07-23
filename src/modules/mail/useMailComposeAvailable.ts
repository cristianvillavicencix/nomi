import { useGetIdentity } from "ra-core";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import { useMailAccounts } from "./useMailAccounts";

export function useMailComposeAvailable() {
  const { identity } = useGetIdentity();
  const { data: accounts = [], isPending } = useMailAccounts();

  const canOrgSend = hasMemberCapability(identity as any, "mail.org.send");
  const canPersonalSend = hasMemberCapability(
    identity as any,
    "mail.personal.send",
  );
  const hasSendPermission = canOrgSend || canPersonalSend;

  const hasConnectedAccount = accounts.some((a) => a.status === "connected");

  const canCompose = hasSendPermission && hasConnectedAccount;

  return {
    canCompose,
    isPending,
    hasSendPermission,
    hasConnectedAccount,
  };
}
