import { Draggable } from "@hello-pangea/dnd";
import { Link } from "react-router";
import { Mail, Phone } from "lucide-react";

import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Contact } from "@/components/atomic-crm/types";
import { getLeadShowPath } from "@/lbs/routing";

const primaryEmail = (contact: Contact) =>
  contact.email_jsonb?.find((email) => String(email.email ?? "").trim())
    ?.email ?? null;

const primaryPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((phone) => String(phone.number ?? "").trim())
    ?.number ?? null;

const displayName = (contact: Contact) =>
  `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
  contact.company_name ||
  "Sin nombre";

export type LeadCardProps = {
  lead: Contact;
  index: number;
};

export const LeadCard = ({ lead, index }: LeadCardProps) => {
  const name = displayName(lead);
  const email = primaryEmail(lead);
  const phone = primaryPhone(lead);

  return (
    <Draggable draggableId={String(lead.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Link
            to={getLeadShowPath(lead.id)}
            className={cn(
              "block focus-visible:outline-none",
              snapshot.isDragging ? "rotate-1" : "",
            )}
          >
            <Card
              className={cn(
                "gap-2 p-3 shadow-sm transition-shadow hover:shadow-md",
                snapshot.isDragging ? "shadow-xl ring-2 ring-primary/40" : "",
              )}
            >
              <div className="flex items-start gap-2.5">
                <Avatar record={lead} width={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">
                    {name}
                  </p>
                  {lead.company_name ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.company_name}
                    </p>
                  ) : null}
                </div>
              </div>

              {lead.interested_service ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {lead.interested_service}
                </p>
              ) : null}

              {(email || phone) && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {email ? (
                    <span className="inline-flex max-w-full items-center gap-1 truncate">
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate">{email}</span>
                    </span>
                  ) : null}
                  {phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3 shrink-0" />
                      <span>{phone}</span>
                    </span>
                  ) : null}
                </div>
              )}
            </Card>
          </Link>
        </div>
      )}
    </Draggable>
  );
};
