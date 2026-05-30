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
import type { Identifier } from "ra-core";
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
import { cn } from "@/lib/utils";
import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import { NoteCreateSheet } from "@/components/atomic-crm/notes/NoteCreateSheet";
import { CalendarReminderDialog } from "@/lbs/calendar/CalendarReminderDialog";
import type { Contact } from "@/components/atomic-crm/types";
import { mailtoHref, normalizePhoneForTel } from "@/lib/linking";
import { contactHasSmsPhone } from "@/lbs/messages/messageContactUtils";
import { useMessagingEnabled } from "@/lbs/messages/useMessagingEnabled";
import { useMessagesQuickAccessOptional } from "@/lbs/messages/messagesQuickAccessContext";
import {
  getContactEmail,
  getContactPhone,
} from "@/lbs/clients/clientShowUtils";

type ContactQuickActionsProps = {
  contactId: Identifier;
  contact: Contact;
  compact?: boolean;
};

const LabeledAction = ({
  label,
  children,
  compact = false,
}: {
  label: string;
  children: ReactNode;
  compact?: boolean;
}) => (
  <div
    className={cn(
      "flex flex-col items-center",
      compact
        ? "shrink-0 gap-1"
        : "min-w-0 flex-1 gap-1.5",
    )}
  >
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

export const ContactQuickActions = ({
  contactId,
  contact,
  compact = false,
}: ContactQuickActionsProps) => {
  const [noteOpen, setNoteOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const { smsEnabled } = useMessagingEnabled();
  const messagesQuickAccess = useMessagesQuickAccessOptional();

  const emailRaw = getContactEmail(contact);
  const email = emailRaw !== "—" ? emailRaw : "";
  const phoneRaw = getContactPhone(contact);
  const phoneLink =
    phoneRaw !== "—" ? normalizePhoneForTel(phoneRaw) : null;
  const today = new Date().toISOString().slice(0, 10);
  const canSms =
    smsEnabled && contactHasSmsPhone(contact) && messagesQuickAccess;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "flex items-start",
          compact
            ? "flex-wrap justify-center gap-2.5"
            : "justify-between gap-1",
        )}
      >
        <LabeledAction label="Note" compact={compact}>
          <CircleButton label="Note" onClick={() => setNoteOpen(true)}>
            <StickyNote className="size-4" />
          </CircleButton>
        </LabeledAction>

        <LabeledAction label="Email" compact={compact}>
          <CircleButton
            label="Email"
            href={email ? mailtoHref(email) : undefined}
            disabled={!email}
          >
            <Mail className="size-4" />
          </CircleButton>
        </LabeledAction>

        <LabeledAction label="Call" compact={compact}>
          <CircleButton
            label="Call"
            href={phoneLink?.telHref ?? undefined}
            disabled={!phoneLink?.telHref}
          >
            <Phone className="size-4" />
          </CircleButton>
        </LabeledAction>

        <LabeledAction label="Message" compact={compact}>
          <CircleButton
            label="Message"
            disabled={!canSms}
            onClick={() => {
              if (messagesQuickAccess) {
                void messagesQuickAccess.openSms(contact);
              }
            }}
          >
            <MessageSquare className="size-4" />
          </CircleButton>
        </LabeledAction>

        {compact ? (
          <>
            <LabeledAction label="Task" compact={compact}>
              <CircleButton label="Task" onClick={() => setTaskOpen(true)}>
                <ListTodo className="size-4" />
              </CircleButton>
            </LabeledAction>

            <LabeledAction label="Meeting" compact={compact}>
              <CircleButton
                label="Meeting"
                onClick={() => setMeetingOpen(true)}
              >
                <Calendar className="size-4" />
              </CircleButton>
            </LabeledAction>
          </>
        ) : (
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
                <DropdownMenuItem onClick={() => setTaskOpen(true)}>
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
        )}
      </div>

      <NoteCreateSheet
        open={noteOpen}
        onOpenChange={setNoteOpen}
        contact_id={contactId}
      />

      <AddTask
        display="icon"
        contactId={contactId}
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
          contact_id: contactId,
        }}
      />
    </TooltipProvider>
  );
};
