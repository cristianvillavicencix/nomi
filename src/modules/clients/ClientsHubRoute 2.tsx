import { useMemo, type ReactNode } from "react";
import { useGetIdentity } from "ra-core";
import { Navigate } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessibleClientsHubTabs } from "@/modules/clients/clientsHubAccess";

/** Route guard: allow `/clients` when the user can access at least one hub tab. */
export const ClientsHubRoute = ({ children }: { children: ReactNode }) => {
  const { data: identity, isPending } = useGetIdentity();
  const accessibleTabs = useMemo(
    () => getAccessibleClientsHubTabs(identity),
    [identity],
  );

  if (isPending) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (!identity || accessibleTabs.length === 0) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
