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

import { IconButton } from "@/components/ui/icon-button";
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
import { CalendarReminderDialog } from "@/modules/calendar/CalendarReminderDialog";
import type { Contact } from "@/components/atomic-crm/types";
import { mailtoHref, normalizePhoneForTel } from "@/lib/linking";
import { useCrmPhoneCall } from "@/modules/voice/useCrmPhoneCall";
import { contactHasSmsPhone } from "@/modules/messages/messageContactUtils";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { useMessagesQuickAccessOptional } from "@/modules/messages/messagesQuickAccessContext";
import {
  getContactEmail,
  getContactPhone,
  getContactPhoneRaw,
} from "@/modules/clients/clientShowUtils";

type ContactQuickActionsProps = {
  contactId: Identifier;
  contact: Contact;
  /** Smaller icons with labels under each action (centered wrap). */
  compact?: boolean;
  /**
   * Icon-only circular buttons in a single row (no labels).
   * Primary: Email, Call, Message, More (Note / Task / Meeting).
   */
  iconRow?: boolean;
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
      compact ? "shrink-0 gap-1" : "min-w-0 flex-1 gap-1.5",
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
    <IconButton
      aria-label={label}
      asChild
      variant="secondary"
      className="size-10 shrink-0 rounded-full"
      disabled={disabled}
    >
      <a href={href} aria-label={label}>
        {children}
      </a>
    </IconButton>
  ) : (
    <IconButton
      variant="secondary"
      className="size-10 shrink-0 rounded-full"
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </IconButton>
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
  iconRow = false,
}: ContactQuickActionsProps) => {
  const [noteOpen, setNoteOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const { smsEnabled } = useMessagingEnabled();
  const messagesQuickAccess = useMessagesQuickAccessOptional();

  const emailRaw = getContactEmail(contact);
  const email = emailRaw !== "—" ? emailRaw : "";
  const phoneRaw = getContactPhoneRaw(contact);
  const phoneLink = phoneRaw ? normalizePhoneForTel(phoneRaw) : null;
  const { canCall, voiceReady, callPhone } = useCrmPhoneCall();
  const canCallPhone = Boolean(phoneLink?.e164 && canCall && voiceReady);
  const today = new Date().toISOString().slice(0, 10);
  const canSms =
    smsEnabled && contactHasSmsPhone(contact) && messagesQuickAccess;

  const emailButton = (
    <CircleButton
      label="Email"
      href={email ? mailtoHref(email) : undefined}
      disabled={!email}
    >
      <Mail className="size-4" />
    </CircleButton>
  );

  const callButton = (
    <CircleButton
      label="Call"
      onClick={() => {
        if (phoneLink?.e164) {
          void callPhone({ to: phoneLink.e164, contactId });
        }
      }}
      disabled={!canCallPhone}
    >
      <Phone className="size-4" />
    </CircleButton>
  );

  const messageButton = (
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
  );

  const moreMenu = (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <IconButton
              variant="secondary"
              className="size-10 rounded-full"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-4" />
            </IconButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>More</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setNoteOpen(true)}>
          <StickyNote className="size-4" />
          Note
        </DropdownMenuItem>
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
  );

  return (
    <TooltipProvider delayDuration={200}>
      {iconRow ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {emailButton}
          {callButton}
          {messageButton}
          {moreMenu}
        </div>
      ) : (
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
            {emailButton}
          </LabeledAction>

          <LabeledAction label="Call" compact={compact}>
            {callButton}
          </LabeledAction>

          <LabeledAction label="Message" compact={compact}>
            {messageButton}
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
            <LabeledAction label="More">{moreMenu}</LabeledAction>
          )}
        </div>
      )}

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
