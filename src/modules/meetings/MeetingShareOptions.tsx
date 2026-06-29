import { useEffect } from "react";
import { Mail, MessageSquare } from "lucide-react";
import { useGetOne, type Identifier } from "ra-core";
import { useWatch } from "react-hook-form";
import type { Contact } from "@/components/atomic-crm/types";
import { Checkbox } from "@/components/ui/checkbox";
import { getContactEmail } from "@/modules/billing/billingUtils";
import {
  contactHasSmsPhone,
} from "@/modules/messages/messageContactUtils";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { cn } from "@/lib/utils";

export const MeetingShareOptions = ({
  emailConfigured,
  shareEmail,
  shareSms,
  onShareEmailChange,
  onShareSmsChange,
  contactId: contactIdProp,
}: {
  emailConfigured: boolean;
  shareEmail: boolean;
  shareSms: boolean;
  onShareEmailChange: (value: boolean) => void;
  onShareSmsChange: (value: boolean) => void;
  contactId?: Identifier | null;
}) => {
  const { smsEnabled } = useMessagingEnabled();
  const watchedContactId = useWatch({ name: "contact_id" }) as Identifier | null;
  const contactId = contactIdProp ?? watchedContactId;

  const { data: contact } = useGetOne<Contact>(
    "contacts_summary",
    { id: contactId! },
    { enabled: contactId != null && String(contactId).trim() !== "" },
  );

  const canEmail = emailConfigured && Boolean(getContactEmail(contact));
  const canSms = smsEnabled && contact != null && contactHasSmsPhone(contact);
  const contactFirstName = contact?.first_name?.trim() || "contact";

  useEffect(() => {
    if (!canEmail && shareEmail) onShareEmailChange(false);
  }, [canEmail, onShareEmailChange, shareEmail]);

  useEffect(() => {
    if (!canSms && shareSms) onShareSmsChange(false);
  }, [canSms, onShareSmsChange, shareSms]);

  useEffect(() => {
    if (!contact?.id) return;
    onShareEmailChange(canEmail);
    onShareSmsChange(canSms);
  }, [contact?.id, canEmail, canSms, onShareEmailChange, onShareSmsChange]);

  if (!contact?.id) return null;

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm font-medium">
        Send invitation to {contactFirstName}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-6">
        <label
          className={cn(
            "flex items-center gap-2 text-sm",
            !canEmail && "opacity-50",
          )}
        >
          <Checkbox
            checked={shareEmail && canEmail}
            disabled={!canEmail}
            onCheckedChange={(checked) =>
              onShareEmailChange(checked === true)
            }
          />
          <Mail className="size-4 text-muted-foreground" />
          Email
          {!canEmail ? (
            <span className="text-xs text-muted-foreground">
              {!emailConfigured ? "(not configured)" : "(no email)"}
            </span>
          ) : null}
        </label>
        <label
          className={cn(
            "flex items-center gap-2 text-sm",
            !canSms && "opacity-50",
          )}
        >
          <Checkbox
            checked={shareSms && canSms}
            disabled={!canSms}
            onCheckedChange={(checked) => onShareSmsChange(checked === true)}
          />
          <MessageSquare className="size-4 text-muted-foreground" />
          SMS
          {!canSms ? (
            <span className="text-xs text-muted-foreground">
              {!smsEnabled ? "(not configured)" : "(no phone)"}
            </span>
          ) : null}
        </label>
      </div>
    </div>
  );
};
