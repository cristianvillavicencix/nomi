import { Draggable } from "@hello-pangea/dnd";
import { Link } from "react-router";
import { GripVertical, Mail, Phone } from "lucide-react";

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
        <div ref={provided.innerRef} {...provided.draggableProps}>
          <Card
            className={cn(
              "group relative gap-2 p-3 shadow-sm transition-shadow",
              snapshot.isDragging
                ? "rotate-1 shadow-xl ring-2 ring-primary/40"
                : "hover:shadow-md",
            )}
          >
            <div
              {...provided.dragHandleProps}
              className={cn(
                "absolute right-1 top-1 grid size-6 cursor-grab place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity",
                "group-hover:opacity-100 focus-visible:opacity-100",
                "hover:bg-muted hover:text-foreground active:cursor-grabbing",
              )}
              aria-label="Arrastrar lead"
              role="button"
              tabIndex={0}
            >
              <GripVertical className="size-3.5" />
            </div>
            <Link
              to={getLeadShowPath(lead.id)}
              className="block focus-visible:outline-none"
            >
              <div className="flex items-start gap-2.5 pr-6">
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
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {lead.interested_service}
                </p>
              ) : null}

              {(email || phone) && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
            </Link>
          </Card>
        </div>
      )}
    </Draggable>
  );
};
