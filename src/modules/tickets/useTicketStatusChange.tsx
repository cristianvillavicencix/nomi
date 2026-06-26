import { useCallback, useState } from "react";
import { useNotify, useRefresh, useUpdate } from "ra-core";
import type { Ticket } from "@/modules/types";
import { requiresTicketStatusNote } from "@/modules/tickets/ticketStatusWorkflow";
import {
  TicketStatusChangeDialog,
  type TicketStatusChangeRequest,
} from "@/modules/tickets/TicketStatusChangeDialog";

export const useTicketStatusChange = (onUpdated?: () => void) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();
  const [statusChangeRequest, setStatusChangeRequest] =
    useState<TicketStatusChangeRequest | null>(null);

  const applyStatusChange = useCallback(
    (ticket: Ticket, nextStatus: string) => {
      if (nextStatus === ticket.status) return;

      if (requiresTicketStatusNote(ticket.status, nextStatus)) {
        setStatusChangeRequest({ ticket, nextStatus });
        return;
      }

      update(
        "tickets",
        { id: ticket.id, data: { status: nextStatus }, previousData: ticket },
        {
          onSuccess: () => {
            notify("Status updated", { type: "info" });
            onUpdated?.();
            refresh();
          },
          onError: () => notify("Could not update status", { type: "error" }),
        },
      );
    },
    [notify, onUpdated, refresh, update],
  );

  const dialog = (
    <TicketStatusChangeDialog
      request={statusChangeRequest}
      onClose={() => setStatusChangeRequest(null)}
      onSuccess={onUpdated}
    />
  );

  return { applyStatusChange, statusChangeDialog: dialog };
};
