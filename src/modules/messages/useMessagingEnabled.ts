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
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  return {
    smsEnabled: data?.sms_enabled === true,
    voiceEnabled: data?.voice_enabled === true,
    // Avoid unregistering the softphone when refetching settings on tab focus.
    isPending: identityPending || (isPending && !data),
  };
};
