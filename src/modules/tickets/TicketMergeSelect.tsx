import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  useDataProvider,
  useGetList,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Ticket } from "@/modules/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const TicketMergeSelect = ({
  ticket,
  onMerged,
}: {
  ticket: Ticket;
  onMerged?: (primaryTicketId: Identifier) => void;
}) => {
  const canManage = useMemberCapability("support.tickets.manage");
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [resetKey, setResetKey] = useState(0);

  const requesterEmail = ticket.requester_email?.trim().toLowerCase() ?? "";

  const { data: relatedTickets = [] } = useGetList<Ticket>(
    "tickets",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "updated_at", order: "DESC" },
      filter: requesterEmail
        ? {
            "requester_email@eq": requesterEmail,
            "merged_into_ticket_id@is": null,
            "id@neq": ticket.id,
          }
        : { "id@eq": -1 },
    },
    { enabled: Boolean(requesterEmail) },
  );

  const mergeCandidates = useMemo(
    () => relatedTickets.filter((row) => String(row.id) !== String(ticket.id)),
    [relatedTickets, ticket.id],
  );

  const mergeMutation = useMutation({
    mutationFn: (mergeTicketId: string) =>
      dataProvider.mergeTickets({
        primaryTicketId: ticket.id,
        mergeTicketIds: [mergeTicketId],
      }),
    onSuccess: (result) => {
      notify(`Merged ticket into #${ticket.id}`, { type: "success" });
      setResetKey((current) => current + 1);
      refresh();
      onMerged?.(result.primary_ticket_id);
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to merge tickets", { type: "error" });
    },
  });

  if (!canManage || ticket.merged_into_ticket_id || !requesterEmail) {
    return null;
  }

  if (!mergeCandidates.length) return null;

  return (
    <Select
      key={resetKey}
      disabled={mergeMutation.isPending}
      onValueChange={(ticketId) => mergeMutation.mutate(ticketId)}
    >
      <SelectTrigger className="h-9 min-w-[120px] rounded-full">
        <SelectValue placeholder="Merge" />
      </SelectTrigger>
      <SelectContent>
        {mergeCandidates.map((candidate) => (
          <SelectItem key={String(candidate.id)} value={String(candidate.id)}>
            #{candidate.id} · {candidate.subject}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
