import { useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import { useGetOne, useDataProvider, type Identifier } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import type { CalendarEventRecord, Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { Button } from "@/components/ui/button";
import { getContactEmail } from "@/modules/billing/billingUtils";
import { contactHasSmsPhone } from "@/modules/messages/messageContactUtils";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { MeetingResendInviteDialog } from "@/modules/meetings/MeetingResendInviteDialog";

export const MeetingResendInviteActions = ({
  meeting,
}: {
  meeting: CalendarEventRecord;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { smsEnabled } = useMessagingEnabled();
  const [previewChannel, setPreviewChannel] = useState<"email" | "sms" | null>(
    null,
  );

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

  if (!canEmail && !canSms) return null;

  return (
    <>
      {canEmail ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2"
          onClick={() => setPreviewChannel("email")}
        >
          <Mail className="size-3.5" />
          Resend email
        </Button>
      ) : null}
      {canSms ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2"
          onClick={() => setPreviewChannel("sms")}
        >
          <MessageSquare className="size-3.5" />
          Resend SMS
        </Button>
      ) : null}
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
