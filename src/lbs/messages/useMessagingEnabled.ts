import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useGetIdentity } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

export const useMessagingEnabled = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity, isPending: identityPending } = useGetIdentity();
  const { data, isPending } = useQuery({
    queryKey: ["messaging-settings"],
    queryFn: () => dataProvider.getMessagingSettings(),
    enabled: !!identity?.id,
    staleTime: 60_000,
    retry: false,
  });

  return {
    smsEnabled: data?.sms_enabled === true,
    isPending: identityPending || isPending,
  };
};
