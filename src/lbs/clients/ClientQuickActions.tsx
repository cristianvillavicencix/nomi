import { useState, type ReactNode } from "react";
import {
  Calendar,
  ListTodo,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Phone,
  StickyNote,
} from "lucide-react";
import { useGetOne, type Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import { NoteCreateSheet } from "@/components/atomic-crm/notes/NoteCreateSheet";
import { CalendarReminderDialog } from "@/lbs/calendar/CalendarReminderDialog";
import type { Contact } from "@/components/atomic-crm/types";
import { mailtoHref, normalizePhoneForTel } from "@/lib/linking";
import { contactHasSmsPhone } from "@/lbs/messages/messageContactUtils";
import { useMessagingEnabled } from "@/lbs/messages/useMessagingEnabled";
import { useMessagesQuickAccessOptional } from "@/lbs/messages/messagesQuickAccessContext";
import {
  getPrimaryContactEmailFromContact,
  getPrimaryContactPhone,
  type CompanyWithPrimaryContact,
} from "@/lbs/clients/clientProfile";

type ClientQuickActionsProps = {
  record: CompanyWithPrimaryContact;
  primaryContactId?: Identifier | null;
};

const LabeledAction = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
    {children}
    <span className="text-[10px] text-muted-foreground">{label}</span>
  </div>
);

const CircleButton = ({
  label,
  onClick,
  href,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  children: ReactNode;
}) => {
  const button = href ? (
    <Button
      asChild
      type="button"
      variant="outline"
      size="icon"
      className="size-10 shrink-0 rounded-full"
      disabled={disabled}
    >
      <a href={href} aria-label={label}>
        {children}
      </a>
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 shrink-0 rounded-full"
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};

export const ClientQuickActions = ({
  record,
  primaryContactId,
}: ClientQuickActionsProps) => {
  const [noteOpen, setNoteOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const { smsEnabled } = useMessagingEnabled();
  const messagesQuickAccess = useMessagesQuickAccessOptional();

  const { data: primaryContact } = useGetOne<Contact>(
    "contacts",
    { id: primaryContactId! },
    { enabled: !!primaryContactId },
  );

  const email =
    getPrimaryContactEmailFromContact(primaryContact) !== "—"
      ? getPrimaryContactEmailFromContact(primaryContact)
      : "";
  const phoneRaw = getPrimaryContactPhone(record);
  const phoneLink =
    phoneRaw !== "—" ? normalizePhoneForTel(phoneRaw) : null;
  const today = new Date().toISOString().slice(0, 10);
  const canSms =
    smsEnabled &&
    primaryContact &&
    contactHasSmsPhone(primaryContact) &&
    messagesQuickAccess;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-start justify-between gap-1">
        <LabeledAction label="Note">
          <CircleButton
            label="Note"
            onClick={() => setNoteOpen(true)}
            disabled={!primaryContactId}
          >
            <StickyNote className="size-4" />
          </CircleButton>
        </LabeledAction>

        <LabeledAction label="Email">
          <CircleButton
            label="Email"
            href={email ? mailtoHref(email) : undefined}
            disabled={!email}
          >
            <Mail className="size-4" />
          </CircleButton>
        </LabeledAction>

        <LabeledAction label="Call">
          <CircleButton
            label="Call"
            href={phoneLink?.telHref ?? undefined}
            disabled={!phoneLink?.telHref}
          >
            <Phone className="size-4" />
          </CircleButton>
        </LabeledAction>

        <LabeledAction label="Message">
          <CircleButton
            label="Message"
            disabled={!canSms}
            onClick={() => {
              if (primaryContact && messagesQuickAccess) {
                void messagesQuickAccess.openSms(primaryContact);
              }
            }}
          >
            <MessageSquare className="size-4" />
          </CircleButton>
        </LabeledAction>

        <LabeledAction label="More">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10 rounded-full"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="center">
              <DropdownMenuItem
                disabled={!primaryContactId}
                onClick={() => setTaskOpen(true)}
              >
                <ListTodo className="size-4" />
                Task
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMeetingOpen(true)}>
                <Calendar className="size-4" />
                Meeting
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </LabeledAction>
      </div>

      <NoteCreateSheet
        open={noteOpen}
        onOpenChange={setNoteOpen}
        contact_id={primaryContactId ?? undefined}
      />

      <AddTask
        display="icon"
        contactId={primaryContactId ?? undefined}
        open={taskOpen}
        onOpenChange={setTaskOpen}
        hideTrigger
      />

      <CalendarReminderDialog
        open={meetingOpen}
        onOpenChange={setMeetingOpen}
        dateKey={today}
        variant="meeting"
        initialRecord={{
          contact_id: primaryContactId ?? null,
        }}
      />
    </TooltipProvider>
  );
};
