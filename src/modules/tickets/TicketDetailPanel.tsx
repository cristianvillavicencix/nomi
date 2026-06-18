import {
  useGetOne,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Ticket, TicketMessage } from "@/modules/types";
import { TicketReplyForm } from "@/modules/tickets/TicketReplyForm";
import { TicketThread } from "@/modules/tickets/TicketThread";
import {
  ticketStatusLabel,
  ticketStatusVariant,
} from "@/modules/tickets/ticketInboxConfig";
import { getClientShowPath } from "@/app/routing";

export const TicketDetailPanel = ({ ticketId }: { ticketId: string }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();
  const { data: ticket, isPending } = useGetOne<Ticket>("tickets", {
    id: ticketId,
  });

  const handleStatusChange = (status: string) => {
    if (!ticket) return;
    update(
      "tickets",
      { id: ticket.id, data: { status }, previousData: ticket },
      {
        onSuccess: () => {
          notify("Status updated", { type: "info" });
          refresh();
        },
        onError: () => notify("Could not update status", { type: "error" }),
      },
    );
  };

  if (isPending || !ticket) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading ticket…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <h2 className="text-xl font-semibold leading-tight">
              {ticket.subject}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {ticket.company_id ? (
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  record={ticket}
                  link={(companyId) => getClientShowPath(companyId)}
                />
              ) : (
                <span>{ticket.requester_name || ticket.requester_email || "Unknown"}</span>
              )}
              {ticket.requester_email ? (
                <>
                  <span>·</span>
                  <span>{ticket.requester_email}</span>
                </>
              ) : null}
              {ticket.deal_id ? (
                <>
                  <span>·</span>
                  <Link
                    to={`/deals/${ticket.deal_id}/show`}
                    className="font-medium text-primary hover:underline"
                  >
                    View deal
                  </Link>
                </>
              ) : null}
            </div>
            {ticket.merge_note ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {ticket.merge_note}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={ticketStatusVariant(ticket.status)}
              className="capitalize"
            >
              {ticketStatusLabel(ticket.status)}
            </Badge>
            <Select value={ticket.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <ReferenceManyField<Ticket, TicketMessage>
          reference="ticket_messages"
          target="ticket_id"
          record={ticket}
          sort={{ field: "created_at", order: "ASC" }}
        >
          <TicketThread />
        </ReferenceManyField>
      </div>

      <div className="border-t bg-background px-5 py-4">
        <TicketReplyForm ticket={ticket} />
      </div>
    </div>
  );
};
