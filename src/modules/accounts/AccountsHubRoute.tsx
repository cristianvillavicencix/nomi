import { useMemo, type ReactNode } from "react";
import { useGetIdentity } from "ra-core";
import { Navigate } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { canAccessAccountsHub } from "@/modules/accounts/accountsHubAccess";

/** Route guard: allow Accounts hub when List or Board is accessible. */
export const AccountsHubRoute = ({ children }: { children: ReactNode }) => {
  const { data: identity, isPending } = useGetIdentity();
  const allowed = useMemo(() => canAccessAccountsHub(identity), [identity]);

  if (isPending) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (!identity || !allowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
