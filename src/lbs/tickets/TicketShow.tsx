import { ShowBase, useListContext, useShowContext } from "ra-core";
import { useParams } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import type { Ticket, TicketMessage } from "@/lbs/types";
import { TicketReplyForm } from "@/lbs/tickets/TicketReplyForm";

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const TicketShow = () => {
  const { id } = useParams();
  if (!id) return null;

  return (
    <ShowBase resource="tickets" id={id}>
      <TicketShowContent />
    </ShowBase>
  );
};

const TicketShowContent = () => {
  const { record, isPending } = useShowContext<Ticket>();

  if (isPending || !record) return null;

  return (
    <div className="mt-2 space-y-4">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{record.subject}</h1>
          <AddTask
            display="chip"
            contactId={record.contact_id ?? undefined}
            dealId={record.deal_id ?? undefined}
            selectContact={!record.contact_id}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline" className="capitalize">
            {record.status}
          </Badge>
          <Badge variant="secondary" className="capitalize">
            {record.priority}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ticket details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Client</div>
            {record.company_id ? (
              <ReferenceField
                source="company_id"
                reference="companies"
                record={record}
                link={(companyId) => `/clients/${companyId}/show`}
              />
            ) : (
              "—"
            )}
          </div>
          <div>
            <div className="text-muted-foreground">Contact</div>
            {record.contact_id ? (
              <ReferenceField
                source="contact_id"
                reference="contacts_summary"
                record={record}
              />
            ) : (
              "—"
            )}
          </div>
          <div>
            <div className="text-muted-foreground">Project</div>
            {record.deal_id ? (
              <ReferenceField
                source="deal_id"
                reference="deals"
                record={record}
                link={(dealId) => `/deals/${dealId}/show`}
              />
            ) : (
              "—"
            )}
          </div>
          <div>
            <div className="text-muted-foreground">Created</div>
            <div>{formatDateTime(record.created_at)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferenceManyField<Ticket, TicketMessage>
            reference="ticket_messages"
            target="ticket_id"
            sort={{ field: "created_at", order: "ASC" }}
            empty={
              <p className="text-sm text-muted-foreground">
                No messages on this ticket yet.
              </p>
            }
          >
            <TicketMessagesList />
          </ReferenceManyField>
          <TicketReplyForm ticket={record} />
        </CardContent>
      </Card>
    </div>
  );
};

const TicketMessagesList = () => {
  const { data = [], isPending } = useListContext<TicketMessage>();

  if (isPending) return null;

  return (
    <ul className="space-y-3">
      {data.map((message) => (
        <li key={message.id} className="rounded-lg border p-3 text-sm">
          <div className="mb-1 text-xs text-muted-foreground">
            {formatDateTime(message.created_at)}
          </div>
          <div className="whitespace-pre-wrap">{message.body}</div>
        </li>
      ))}
    </ul>
  );
};
