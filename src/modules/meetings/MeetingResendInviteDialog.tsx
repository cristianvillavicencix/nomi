import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  type Identifier,
} from "ra-core";
import { useQuery } from "@tanstack/react-query";
import type { CalendarEventRecord, Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/timezone/usTimezone";
import { InvoiceSendDeliveryPreview } from "@/modules/billing/InvoiceSendDeliveryPreview";
import { getContactEmail } from "@/modules/billing/billingUtils";
import { getContactPhone } from "@/modules/clients/clientShowUtils";
import {
  buildMeetingInviteEmailHtml,
  buildMeetingInviteSubject,
} from "@/modules/meetings/meetingInvitePreview";
import {
  buildQuickMeetingShareParts,
  getSenderFirstName,
} from "@/modules/meetings/quickMeetingShareMessage";
import { sendMeetingShareNotifications } from "@/modules/meetings/sendMeetingShareNotifications";

export const MeetingResendInviteDialog = ({
  meeting,
  channel,
  open,
  onOpenChange,
}: {
  meeting: CalendarEventRecord;
  channel: "email" | "sms";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const config = useConfigurationContext();
  const [sending, setSending] = useState(false);

  const contactId = meeting.contact_id as Identifier | null | undefined;

  const { data: contact } = useGetOne<Contact>(
    "contacts_summary",
    { id: contactId! },
    {
      enabled:
        open && contactId != null && String(contactId).trim() !== "",
    },
  );

  const { data: emailSettings } = useQuery({
    queryKey: ["email-delivery-settings"],
    queryFn: () => dataProvider.getEmailDeliverySettings(),
    enabled: open,
    staleTime: 60_000,
  });

  const orgName = emailSettings?.org_name?.trim() || "Latino Business Support";
  const meetingTitle = String(meeting.title ?? "").trim() || "Video call";
  const meetingTimezone =
    String(meeting.timezone ?? "").trim() ||
    String(config.companyTimezone ?? "").trim() ||
    DEFAULT_ORG_TIMEZONE;

  const share = useMemo(
    () =>
      buildQuickMeetingShareParts({
        contact,
        meetingUrl: String(meeting.meeting_url ?? "").trim(),
        notes: meeting.description,
        senderFirstName: getSenderFirstName(identity),
        orgName,
        eventDate: meeting.event_date,
        eventTime: meeting.event_time,
        durationMinutes: meeting.duration_minutes,
        meetingTimezone,
      }),
    [contact, identity, meeting, meetingTimezone, orgName],
  );

  const emailTo = getContactEmail(contact) ?? "";
  const smsTo = getContactPhone(contact);
  const smsToDisplay = smsTo !== "—" ? smsTo : "";
  const subject = buildMeetingInviteSubject(orgName, meetingTitle);
  const emailHtml = buildMeetingInviteEmailHtml(share);

  const handleSend = async () => {
    setSending(true);
    try {
      const { errors } = await sendMeetingShareNotifications({
        record: meeting,
        shareEmail: channel === "email",
        shareSms: channel === "sms",
        dataProvider,
      });
      if (errors.length > 0) {
        notify(errors.join(". "), { type: "warning" });
        return;
      }
      notify(
        channel === "email"
          ? "Invitation resent by email"
          : "Invitation resent by SMS",
        { type: "success" },
      );
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {channel === "email"
              ? "Resend email invitation"
              : "Resend SMS invitation"}
          </DialogTitle>
          <DialogDescription>
            Review the message below before sending to{" "}
            {contact?.first_name?.trim() || "the contact"}.
          </DialogDescription>
        </DialogHeader>

        <InvoiceSendDeliveryPreview
          subject={subject}
          emailHtml={emailHtml}
          smsText={share.smsBody}
          emailTo={emailTo}
          smsTo={smsToDisplay}
          sendEmail={channel === "email"}
          sendSms={channel === "sms"}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : null}
            {channel === "email" ? "Send email" : "Send SMS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
