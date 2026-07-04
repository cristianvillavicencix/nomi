import { useCallback, useState } from "react";
import { useNotify, useRefresh, useUpdate, useDataProvider } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Ticket } from "@/modules/types";
import { requiresTicketStatusNote } from "@/modules/tickets/ticketStatusWorkflow";
import {
  TicketStatusChangeDialog,
  type TicketStatusChangeRequest,
} from "@/modules/tickets/TicketStatusChangeDialog";
import { TICKET_WORKSPACE_SETTINGS_QUERY_KEY } from "@/modules/settings/tickets/useTicketWorkspaceSettings";
import { DEFAULT_TICKET_WORKSPACE_SETTINGS } from "@/modules/settings/tickets/ticketWorkspaceSettings";

export const useTicketStatusChange = (onUpdated?: () => void) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [statusChangeRequest, setStatusChangeRequest] =
    useState<TicketStatusChangeRequest | null>(null);

  const { data: workspaceData } = useQuery({
    queryKey: TICKET_WORKSPACE_SETTINGS_QUERY_KEY,
    queryFn: () => dataProvider.getTicketWorkspaceSettings(),
    staleTime: 60_000,
  });
  const requireStatusNote =
    workspaceData?.workspace.require_status_change_note ??
    DEFAULT_TICKET_WORKSPACE_SETTINGS.require_status_change_note;

  const applyStatusChange = useCallback(
    (ticket: Ticket, nextStatus: string) => {
      if (nextStatus === ticket.status) return;

      if (
        requiresTicketStatusNote(ticket.status, nextStatus, {
          required: requireStatusNote,
        })
      ) {
        setStatusChangeRequest({ ticket, nextStatus });
        return;
      }

      update(
        "tickets",
        { id: ticket.id, data: { status: nextStatus }, previousData: ticket },
        {
          onSuccess: () => {
            notify("Status updated", { type: "info" });
            if (nextStatus === "resolved") {
              void dataProvider.sendTicketCsatEmail(Number(ticket.id)).catch(
                () => undefined,
              );
            }
            onUpdated?.();
            refresh();
          },
          onError: () => notify("Could not update status", { type: "error" }),
        },
      );
    },
    [dataProvider, notify, onUpdated, refresh, requireStatusNote, update],
  );

  const dialog = (
    <TicketStatusChangeDialog
      request={statusChangeRequest}
      onClose={() => setStatusChangeRequest(null)}
      onSuccess={onUpdated}
      requireStatusNote={requireStatusNote}
    />
  );

  return { applyStatusChange, statusChangeDialog: dialog };
};
