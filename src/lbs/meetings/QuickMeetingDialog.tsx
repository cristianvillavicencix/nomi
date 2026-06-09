import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Loader2,
  Mail,
  MessageSquare,
  Video,
  X,
  Zap,
} from "lucide-react";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { ReferenceInput } from "@/components/admin/reference-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { prepareCalendarEventWriteData } from "@/lbs/calendar/calendarEventWriteData";
import {
  DEFAULT_MEETING_DURATION_MINUTES,
  DURATION_CHOICES,
  DURATION_NONE,
  REMIND_BEFORE_CHOICES,
  REMIND_BEFORE_NONE,
  getContactDisplayName,
} from "@/lbs/calendar/calendarReminderOptions";
import {
  roundToNextFiveMinutes,
  toDateKey,
} from "@/lbs/calendar/calendarUtils";
import { getContactEmail } from "@/lbs/billing/billingUtils";
import { getInitials } from "@/lbs/messages/conversationDisplay";
import {
  contactHasSmsPhone,
  getContactPhoneLabel,
} from "@/lbs/messages/messageContactUtils";
import { useSendClientSms } from "@/lbs/messages/useClientSms";
import { useMessagingEnabled } from "@/lbs/messages/useMessagingEnabled";
import { MeetingContactTitleSync } from "@/lbs/meetings/meetingFormUtils";
import { MeetingVideoCallSection } from "@/lbs/meetings/MeetingVideoCallSection";
import { cn } from "@/lib/utils";

const LBS_ACCENT = "#378ADD";

const dealOptionText = (choice: {
  name?: string | null;
  id?: number | string;
}) => choice.name?.trim() || `Project #${choice.id}`;

const contactOptionText = (contact: Contact) => getContactDisplayName(contact);

const formatRemindBefore = (value?: number | null) =>
  value == null ? REMIND_BEFORE_NONE : value;

const parseRemindBefore = (value: string | number) => {
  if (value === REMIND_BEFORE_NONE || value === "" || value == null)
    return null;
  return Number(value);
};

const formatDuration = (value?: number | null) =>
  value == null ? DURATION_NONE : value;

const parseDuration = (value: string | number) => {
  if (value === DURATION_NONE || value === "" || value == null) return null;
  return Number(value);
};

const buildShareMessage = (contact?: Contact | null) => {
  const firstName = contact?.first_name?.trim();
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return `${greeting}\n\nJoin our video call using the link below.`;
};

const QuickMeetingContactCard = ({
  contact,
  onClear,
}: {
  contact: Contact;
  onClear: () => void;
}) => {
  const name = getContactDisplayName(contact);
  const email = getContactEmail(contact);
  const phone = getContactPhoneLabel(contact);

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2.5">
      <Avatar className="size-10 shrink-0">
        <AvatarFallback className="bg-[#378ADD]/15 text-sm font-semibold text-[#378ADD]">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[email, phone !== "No phone" ? phone : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground"
        onClick={onClear}
        aria-label="Change contact"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
};

const QuickMeetingStartButton = ({
  contact,
  shareEmail,
  shareSms,
  isSubmitting,
}: {
  contact?: Contact | null;
  shareEmail: boolean;
  shareSms: boolean;
  isSubmitting: boolean;
}) => {
  const hint =
    shareEmail && shareSms
      ? "The link will be sent and the call will open"
      : shareEmail
        ? "The link will be emailed and the call will open"
        : shareSms
          ? "The link will be texted and the call will open"
          : "The call will open in your browser";

  return (
    <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">{hint}</p>
      <Button
        type="submit"
        disabled={isSubmitting || !contact?.id}
        className="w-full sm:w-auto"
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Zap className="size-4" />
        )}
        Start now
      </Button>
    </div>
  );
};

export const QuickMeetingDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const sendClientSms = useSendClientSms();
  const { smsEnabled } = useMessagingEnabled();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareEmail, setShareEmail] = useState(true);
  const [shareSms, setShareSms] = useState(true);
  const [formKey, setFormKey] = useState(0);

  const { data: emailSettings } = useQuery({
    queryKey: ["email-delivery-settings"],
    queryFn: () => dataProvider.getEmailDeliverySettings(),
    enabled: open && !!identity?.id,
    staleTime: 60_000,
  });

  const now = useMemo(() => new Date(), [open, formKey]);

  const defaultValues = useMemo(
    () => ({
      title: "",
      event_date: toDateKey(now),
      event_time: roundToNextFiveMinutes(now),
      duration_minutes: DEFAULT_MEETING_DURATION_MINUTES,
      remind_before_minutes: REMIND_BEFORE_NONE,
      description: "",
      meeting_url: null as string | null,
      contact_id: null as Identifier | null,
      deal_id: null as Identifier | null,
      organization_member_id: identity?.id ?? null,
      completed_at: null,
      _meeting_contact_name: null as string | null,
      _meeting_link_seed: null as string | null,
    }),
    [formKey, identity?.id, now],
  );

  useEffect(() => {
    if (!open) {
      setFormKey((value) => value + 1);
      setShareEmail(true);
      setShareSms(true);
    }
  }, [open]);

  if (!identity || !open) return null;

  const handleSubmit = async (values: Record<string, unknown>) => {
    const contactId = values.contact_id as Identifier | null;
    const meetingUrl = String(values.meeting_url ?? "").trim();
    const title = String(values.title ?? "").trim();

    if (!contactId) {
      notify("Select a contact", { type: "warning" });
      return;
    }
    if (!title || !meetingUrl) {
      notify("Choose a contact to generate the video link", { type: "warning" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = prepareCalendarEventWriteData({
        ...values,
        event_date: toDateKey(new Date()),
        event_time: roundToNextFiveMinutes(new Date()),
        organization_member_id: identity.id,
      });

      await dataProvider.create("calendar_events", { data: payload });

      const notes = String(values.description ?? "").trim();
      const greeting =
        notes ||
        buildShareMessage(
          contactId
            ? ((await dataProvider.getOne("contacts_summary", { id: contactId }))
                .data as Contact)
            : null,
        );
      const shareMessage = [greeting, meetingUrl].filter(Boolean).join("\n\n");

      const errors: string[] = [];

      if (shareEmail) {
        try {
          const result = await dataProvider.sendMeetingLink({
            contactId,
            meetingUrl,
            title,
            message: notes || greeting.split("\n\n")[0],
          });
          notify(`Link sent to ${result.to}`, { type: "info" });
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : "Could not send email",
          );
        }
      }

      if (shareSms) {
        try {
          await sendClientSms({
            contactId,
            dealId: (values.deal_id as Identifier | null) ?? null,
            body: shareMessage,
          });
          notify("Link sent via SMS", { type: "info" });
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : "Could not send SMS",
          );
        }
      }

      refresh();
      onOpenChange(false);
      window.open(meetingUrl, "_blank", "noopener,noreferrer");

      if (errors.length > 0) {
        notify(errors.join(". "), { type: "warning" });
      } else {
        notify("Call started", { type: "success" });
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not start the call",
        { type: "error" },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-y-auto p-0 sm:max-w-lg max-h-[90vh]">
        <Form
          key={formKey}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          className="flex flex-col"
        >
          <MeetingContactTitleSync />
          <QuickMeetingFormBody
            emailConfigured={emailSettings?.configured === true}
            smsEnabled={smsEnabled}
            shareEmail={shareEmail}
            shareSms={shareSms}
            onShareEmailChange={setShareEmail}
            onShareSmsChange={setShareSms}
            isSubmitting={isSubmitting}
          />
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const QuickMeetingFormBody = ({
  emailConfigured,
  smsEnabled,
  shareEmail,
  shareSms,
  onShareEmailChange,
  onShareSmsChange,
  isSubmitting,
}: {
  emailConfigured: boolean;
  smsEnabled: boolean;
  shareEmail: boolean;
  shareSms: boolean;
  onShareEmailChange: (value: boolean) => void;
  onShareSmsChange: (value: boolean) => void;
  isSubmitting: boolean;
}) => {
  const notify = useNotify();
  const { setValue } = useFormContext();
  const contactId = useWatch({ name: "contact_id" }) as Identifier | null;
  const meetingUrl = useWatch({ name: "meeting_url" }) as string | null;

  const { data: contact } = useGetOne<Contact>(
    "contacts_summary",
    { id: contactId! },
    { enabled: contactId != null && String(contactId).trim() !== "" },
  );

  const contactEmail = getContactEmail(contact);
  const canEmail = emailConfigured && Boolean(contactEmail);
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

  const copyLink = async () => {
    if (!meetingUrl?.trim()) return;
    await navigator.clipboard.writeText(meetingUrl);
    notify("Link copied", { type: "info" });
  };

  return (
    <>
      <DialogHeader className="space-y-3 border-b px-6 py-5 text-left">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#378ADD]/10 text-[#378ADD]">
            <Video className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-xl">Quick call</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Starts now · automatic title and link
            </p>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-5 px-6 py-5">
        {contact ? (
          <QuickMeetingContactCard
            contact={contact}
            onClear={() => {
              setValue("contact_id", null, { shouldDirty: true });
              setValue("meeting_url", null, { shouldDirty: true });
            }}
          />
        ) : (
          <div className="space-y-2">
            <Label>Contact</Label>
            <ReferenceInput source="contact_id" reference="contacts_summary">
              <AutocompleteInput
                label={false}
                optionText={contactOptionText}
                inputText={contactOptionText}
                helperText={false}
                modal
                autoFocus
                placeholder="Search contact…"
                validate={(value) => (value ? undefined : "Required")}
                filterToQuery={(searchText) => ({ q: searchText })}
              />
            </ReferenceInput>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Duration</Label>
            <SelectInput
              source="duration_minutes"
              label={false}
              choices={[...DURATION_CHOICES]}
              format={formatDuration}
              parse={parseDuration}
              helperText={false}
            />
          </div>
          <div className="space-y-2">
            <Label>Reminder</Label>
            <SelectInput
              source="remind_before_minutes"
              label={false}
              choices={[...REMIND_BEFORE_CHOICES]}
              format={formatRemindBefore}
              parse={parseRemindBefore}
              helperText={false}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Project (optional)</Label>
          <ReferenceInput source="deal_id" reference="deals">
            <AutocompleteInput
              label={false}
              optionText={dealOptionText}
              helperText={false}
              modal
              placeholder="Search project…"
              filterToQuery={(searchText) => ({ q: searchText })}
            />
          </ReferenceInput>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <TextInput
            source="description"
            label={false}
            multiline
            helperText={false}
            placeholder="Agenda, context…"
          />
        </div>

        {contact ? (
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-medium">
              Share link with {contactFirstName}
            </p>
            <div className="sr-only">
              <MeetingVideoCallSection />
            </div>
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
                  onCheckedChange={(checked) =>
                    onShareSmsChange(checked === true)
                  }
                />
                <MessageSquare className="size-4 text-muted-foreground" />
                SMS
                {!canSms ? (
                  <span className="text-xs text-muted-foreground">
                    {!smsEnabled ? "(not configured)" : "(no phone)"}
                  </span>
                ) : null}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-2 px-2 text-sm font-normal"
                disabled={!meetingUrl?.trim()}
                onClick={() => void copyLink()}
              >
                <Copy className="size-4 text-muted-foreground" />
                Link
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-6 pb-6">
        <QuickMeetingStartButton
          contact={contact}
          shareEmail={shareEmail && canEmail}
          shareSms={shareSms && canSms}
          isSubmitting={isSubmitting}
        />
      </div>
    </>
  );
};
