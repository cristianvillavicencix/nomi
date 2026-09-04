import { useState, type ReactNode } from "react";
import {
  Briefcase,
  Calendar,
  ListTodo,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Phone,
  StickyNote,
  Ticket,
} from "lucide-react";
import { useGetOne, type Identifier } from "ra-core";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
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
import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import { NoteCreateSheet } from "@/components/atomic-crm/notes/NoteCreateSheet";
import { CalendarReminderDialog } from "@/modules/calendar/CalendarReminderDialog";
import { NewTicketDialog } from "@/modules/tickets/NewTicketDialog";
import type { Contact } from "@/components/atomic-crm/types";
import { getClientDealCreatePath } from "@/app/routing";
import { normalizePhoneForTel } from "@/lib/linking";
import { cn } from "@/lib/utils";
import { resolveBillingRecipientEmail } from "@/modules/billing/billingRecipientResolution";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyPhoneRaw,
} from "@/modules/clients/companyChannelResolvers";
import { OpenMailComposeButton } from "@/modules/mail/OpenMailComposeButton";
import { useOpenCrmEmail } from "@/modules/mail/openCrmEmail";
import { useCrmPhoneCall } from "@/modules/voice/useCrmPhoneCall";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import { contactHasSmsPhone } from "@/modules/messages/messageContactUtils";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { useMessagesQuickAccessOptional } from "@/modules/messages/messagesQuickAccessContext";
import {
  getPrimaryContactPhoneRaw,
  type CompanyWithPrimaryContact,
} from "@/modules/clients/clientProfile";

type ClientQuickActionsProps = {
  record: CompanyWithPrimaryContact;
  primaryContactId?: Identifier | null;
  /** Preview-style Call/Email chips + compact secondary actions. */
  presentation?: "circles" | "strip";
  className?: string;
};

const LabeledAction = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex min-w-0 flex-col items-center gap-1.5">
    {children}
    <span className="text-[10px] text-muted-foreground">{label}</span>
  </div>
);

const CircleButton = ({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) => {
  const button = (
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

export const ClientQuickActions = ({
  record,
  primaryContactId,
  presentation = "circles",
  className,
}: ClientQuickActionsProps) => {
  const navigate = useNavigate();
  const [noteOpen, setNoteOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const { smsEnabled } = useMessagingEnabled();
  const messagesQuickAccess = useMessagesQuickAccessOptional();
  const openCrmEmail = useOpenCrmEmail();

  const { data: primaryContact } = useGetOne<Contact>(
    "contacts",
    { id: primaryContactId! },
    { enabled: !!primaryContactId },
  );

  const email =
    resolveBillingRecipientEmail({
      company: record,
      contact: primaryContact ?? null,
    }) ||
    (() => {
      const display = resolveCompanyEmailForDisplay(record);
      return display !== "—" ? display : "";
    })();
  const phoneRaw =
    resolveCompanyPhoneRaw(record) || getPrimaryContactPhoneRaw(record) || "";
  const phoneLink = phoneRaw ? normalizePhoneForTel(phoneRaw) : null;
  const { canCall, voiceReady, callPhone } = useCrmPhoneCall();
  const canCallPhone = Boolean(phoneLink?.e164 && canCall && voiceReady);
  const today = new Date().toISOString().slice(0, 10);
  const canSms =
    smsEnabled &&
    primaryContact &&
    contactHasSmsPhone(primaryContact) &&
    messagesQuickAccess;

  const moreMenu = (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <IconButton
              variant="secondary"
              className={
                presentation === "strip"
                  ? "size-8 shrink-0 rounded-md"
                  : "size-10 rounded-full"
              }
              aria-label="More actions"
            >
              <MoreHorizontal className="size-4" />
            </IconButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>More</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            navigate(
              getClientDealCreatePath(record.id, primaryContactId ?? undefined),
            )
          }
        >
          <Briefcase className="size-4" />
          New project
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setNewTicketOpen(true)}>
          <Ticket className="size-4" />
          New ticket
        </DropdownMenuItem>
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
        <DropdownMenuItem
          disabled={!primaryContactId}
          onClick={() => setNoteOpen(true)}
        >
          <StickyNote className="size-4" />
          Note
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const dialogs = (
    <>
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

      <NewTicketDialog
        open={newTicketOpen}
        onOpenChange={setNewTicketOpen}
        defaultCompanyId={record.id}
        defaultContactId={primaryContactId ?? null}
      />
    </>
  );

  if (presentation === "strip") {
    return (
      <TooltipProvider delayDuration={200}>
        <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
          {phoneRaw ? (
            <CrmPhoneLink
              phone={phoneRaw}
              contactId={primaryContactId ?? undefined}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
            >
              <Phone className="size-3.5" />
              Call
            </CrmPhoneLink>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5"
              disabled
            >
              <Phone className="size-3.5" />
              Call
            </Button>
          )}
          {email ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => {
                openCrmEmail({
                  to: email,
                  companyId: record.id,
                  contactId: primaryContactId ?? undefined,
                });
              }}
            >
              <Mail className="size-3.5" />
              Email
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5"
              disabled
            >
              <Mail className="size-3.5" />
              Email
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5"
            disabled={!canSms}
            onClick={() => {
              if (primaryContact && messagesQuickAccess) {
                void messagesQuickAccess.openSms(primaryContact);
              }
            }}
          >
            <MessageSquare className="size-3.5" />
            Message
          </Button>
          {moreMenu}
        </div>
        {dialogs}
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex items-start justify-end gap-2", className)}>
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
          <OpenMailComposeButton
            to={email}
            companyId={record.id}
            contactId={primaryContactId ?? undefined}
          >
            <Mail className="size-4" />
          </OpenMailComposeButton>
        </LabeledAction>

        <LabeledAction label="Call">
          <CircleButton
            label="Call"
            onClick={() => {
              if (phoneLink?.e164) {
                void callPhone({
                  to: phoneLink.e164,
                  contactId: primaryContactId ?? undefined,
                });
              }
            }}
            disabled={!canCallPhone}
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

        <LabeledAction label="More">{moreMenu}</LabeledAction>
      </div>
      {dialogs}
    </TooltipProvider>
  );
};
