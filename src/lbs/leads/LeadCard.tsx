import { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Link } from "react-router";
import { GripVertical, History, Mail, Phone } from "lucide-react";

import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Contact } from "@/components/atomic-crm/types";
import { LeadActivitySheet } from "@/lbs/leads/LeadActivitySheet";
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
  "Unnamed lead";

const cardActionClassName = (isDragging: boolean) =>
  cn(
    "grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity",
    "group-hover:opacity-100 focus-visible:opacity-100",
    "hover:bg-muted hover:text-foreground",
    isDragging && "opacity-100",
  );

export type LeadCardProps = {
  lead: Contact;
  index: number;
};

export const LeadCard = ({ lead, index }: LeadCardProps) => {
  const [historyOpen, setHistoryOpen] = useState(false);
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
            <div className="absolute right-1 top-1 z-10 flex flex-col gap-0.5">
              <div
                {...provided.dragHandleProps}
                className={cn(
                  cardActionClassName(snapshot.isDragging),
                  "cursor-grab active:cursor-grabbing",
                )}
                aria-label="Drag lead"
                role="button"
                tabIndex={0}
              >
                <GripVertical className="size-3.5" />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  cardActionClassName(snapshot.isDragging),
                  "size-6",
                )}
                title="Activity history"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="size-3.5" />
                <span className="sr-only">Activity history</span>
              </Button>
            </div>

            <div className="pr-6">
              <div className="flex items-start gap-2.5">
                <Link
                  to={getLeadShowPath(lead.id)}
                  className="shrink-0 focus-visible:outline-none"
                >
                  <Avatar record={lead} width={32} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={getLeadShowPath(lead.id)}
                    className="block truncate text-sm font-medium leading-tight focus-visible:outline-none hover:underline"
                  >
                    {name}
                  </Link>
                  {lead.company_name ? (
                    <Link
                      to={getLeadShowPath(lead.id)}
                      className="mt-0.5 block truncate text-xs text-muted-foreground focus-visible:outline-none hover:underline"
                    >
                      {lead.company_name}
                    </Link>
                  ) : null}
                </div>
              </div>

              <Link
                to={getLeadShowPath(lead.id)}
                className="mt-1 block focus-visible:outline-none"
              >
                {lead.interested_service ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
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
            </div>

            <LeadActivitySheet
              lead={lead}
              open={historyOpen}
              onOpenChange={setHistoryOpen}
            />
          </Card>
        </div>
      )}
    </Draggable>
  );
};
