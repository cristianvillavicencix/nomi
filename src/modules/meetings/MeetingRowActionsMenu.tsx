import { useState } from "react";
import {
  Copy,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Video,
} from "lucide-react";
import { useDataProvider, useGetOne, type Identifier } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import type { CalendarEventRecord, Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getContactEmail } from "@/modules/billing/billingUtils";
import { contactHasSmsPhone } from "@/modules/messages/messageContactUtils";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { MeetingResendInviteDialog } from "@/modules/meetings/MeetingResendInviteDialog";

export const MeetingRowActionsMenu = ({
  meeting,
  onEdit,
}: {
  meeting: CalendarEventRecord;
  onEdit: () => void;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { smsEnabled } = useMessagingEnabled();
  const [copied, setCopied] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<"email" | "sms" | null>(
    null,
  );

  const meetingUrl = String(meeting.meeting_url ?? "").trim();
  const contactId = meeting.contact_id as Identifier | null | undefined;

  const { data: contact } = useGetOne<Contact>(
    "contacts_summary",
    { id: contactId! },
    { enabled: contactId != null && String(contactId).trim() !== "" },
  );

  const { data: emailSettings } = useQuery({
    queryKey: ["email-delivery-settings"],
    queryFn: () => dataProvider.getEmailDeliverySettings(),
    staleTime: 60_000,
  });

  const canEmail =
    emailSettings?.configured === true &&
    Boolean(getContactEmail(contact)) &&
    Boolean(meetingUrl);
  const canSms =
    smsEnabled &&
    contact != null &&
    contactHasSmsPhone(contact) &&
    Boolean(meetingUrl);

  const handleCopy = async () => {
    if (!meetingUrl) return;
    await navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {meetingUrl ? (
          <IconButton asChild aria-label="Join call">
            <a
              href={meetingUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Video className="size-4" />
            </a>
          </IconButton>
        ) : null}

        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton aria-label="Meeting actions">
            <MoreHorizontal className="size-4" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {meetingUrl ? (
            <>
              <DropdownMenuItem onSelect={() => void handleCopy()}>
                <Copy className="size-4" />
                {copied ? "Copied" : "Copy link"}
              </DropdownMenuItem>
              {(canEmail || canSms) && <DropdownMenuSeparator />}
            </>
          ) : null}
          {canEmail ? (
            <DropdownMenuItem onSelect={() => setPreviewChannel("email")}>
              <Mail className="size-4" />
              Resend email
            </DropdownMenuItem>
          ) : null}
          {canSms ? (
            <DropdownMenuItem onSelect={() => setPreviewChannel("sms")}>
              <MessageSquare className="size-4" />
              Resend SMS
            </DropdownMenuItem>
          ) : null}
          {(canEmail || canSms || meetingUrl) && <DropdownMenuSeparator />}
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      </div>

      {previewChannel ? (
        <MeetingResendInviteDialog
          meeting={meeting}
          channel={previewChannel}
          open={previewChannel != null}
          onOpenChange={(next) => {
            if (!next) setPreviewChannel(null);
          }}
        />
      ) : null}
    </>
  );
};
