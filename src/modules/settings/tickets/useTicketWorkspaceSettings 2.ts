import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type {
  TicketInboxSettingsRow,
  TicketWorkspaceSettings,
  TicketWorkspaceSettingsResponse,
} from "@/modules/settings/tickets/ticketWorkspaceSettings";

export const TICKET_WORKSPACE_SETTINGS_QUERY_KEY = [
  "ticket-workspace-settings",
] as const;

export const useTicketWorkspaceSettings = (enabled = true) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  return useQuery({
    queryKey: TICKET_WORKSPACE_SETTINGS_QUERY_KEY,
    queryFn: () => dataProvider.getTicketWorkspaceSettings(),
    enabled,
  });
};

export const useTicketWorkspaceSettingsMutations = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (params: Parameters<
      CrmDataProvider["updateTicketWorkspaceSettings"]
    >[0]) => dataProvider.updateTicketWorkspaceSettings(params),
    onSuccess: (saved) => {
      queryClient.setQueryData(TICKET_WORKSPACE_SETTINGS_QUERY_KEY, saved);
    },
  });

  const patchWorkspace = (workspace: Partial<TicketWorkspaceSettings>) =>
    saveMutation.mutateAsync({ workspace });

  const patchInbox = (
    inbox: Partial<TicketInboxSettingsRow> & { id: number },
  ) => saveMutation.mutateAsync({ inbox });

  return { saveMutation, patchWorkspace, patchInbox };
};

export type TicketWorkspaceSettingsContextValue = {
  data: TicketWorkspaceSettingsResponse | undefined;
  isPending: boolean;
  patchWorkspace: (
    workspace: Partial<TicketWorkspaceSettings>,
  ) => Promise<TicketWorkspaceSettingsResponse>;
  patchInbox: (
    inbox: Partial<TicketInboxSettingsRow> & { id: number },
  ) => Promise<TicketWorkspaceSettingsResponse>;
  saving: boolean;
};

export const useTicketWorkspaceSettingsContext = (
  enabled = true,
): TicketWorkspaceSettingsContextValue => {
  const { data, isPending } = useTicketWorkspaceSettings(enabled);
  const { saveMutation, patchWorkspace, patchInbox } =
    useTicketWorkspaceSettingsMutations();

  return {
    data,
    isPending,
    patchWorkspace,
    patchInbox,
    saving: saveMutation.isPending,
  };
};
