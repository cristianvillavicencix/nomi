import { useState } from "react";
import { Loader2, Mail, MessageSquare } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { getContactEmail } from "@/modules/billing/billingUtils";
import { contactHasSmsPhone } from "@/modules/messages/messageContactUtils";
import { useSendClientSms } from "@/modules/messages/useClientSms";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { sendMeetingShareNotifications } from "@/modules/meetings/sendMeetingShareNotifications";

export const MeetingResendInviteActions = ({
  meeting,
}: {
  meeting: CalendarEventRecord;
}) => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const sendClientSms = useSendClientSms();
  const { smsEnabled } = useMessagingEnabled();
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendingSms, setResendingSms] = useState(false);

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
    Boolean(meeting.meeting_url?.trim());
  const canSms =
    smsEnabled &&
    contact != null &&
    contactHasSmsPhone(contact) &&
    Boolean(meeting.meeting_url?.trim());

  const resend = async (channel: "email" | "sms") => {
    if (!meeting.meeting_url?.trim()) {
      notify("This meeting has no video link", { type: "warning" });
      return;
    }

    const setPending =
      channel === "email" ? setResendingEmail : setResendingSms;
    setPending(true);
    try {
      const { errors } = await sendMeetingShareNotifications({
        record: meeting,
        shareEmail: channel === "email",
        shareSms: channel === "sms",
        dataProvider,
        sendClientSms,
        identity,
        orgName: emailSettings?.org_name,
        notify,
      });
      if (errors.length > 0) {
        notify(errors.join(". "), { type: "warning" });
      } else {
        notify(
          channel === "email" ? "Invitation resent by email" : "Invitation resent by SMS",
          { type: "success" },
        );
      }
    } finally {
      setPending(false);
    }
  };

  if (!canEmail && !canSms) return null;

  return (
    <>
      {canEmail ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2"
          disabled={resendingEmail}
          onClick={() => void resend("email")}
        >
          {resendingEmail ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Mail className="size-3.5" />
          )}
          Resend email
        </Button>
      ) : null}
      {canSms ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2"
          disabled={resendingSms}
          onClick={() => void resend("sms")}
        >
          {resendingSms ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <MessageSquare className="size-3.5" />
          )}
          Resend SMS
        </Button>
      ) : null}
    </>
  );
};
