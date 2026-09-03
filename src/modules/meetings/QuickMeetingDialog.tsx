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
import { IconButton } from "@/components/ui/icon-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { prepareCalendarEventWriteData } from "@/modules/calendar/calendarEventWriteData";
import { CreateFormFieldRow } from "@/modules/shared/createForm/CreateFormLayout";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/timezone/usTimezone";
import {
  DEFAULT_MEETING_DURATION_MINUTES,
  DURATION_CHOICES,
  DURATION_NONE,
  REMIND_BEFORE_CHOICES,
  REMIND_BEFORE_NONE,
  getContactDisplayName,
} from "@/modules/calendar/calendarReminderOptions";
import {
  roundToNextFiveMinutes,
  toDateKey,
} from "@/modules/calendar/calendarUtils";
import { getContactEmail } from "@/modules/billing/billingUtils";
import { getInitials } from "@/modules/messages/conversationDisplay";
import {
  contactHasSmsPhone,
  getContactPhoneLabel,
} from "@/modules/messages/messageContactUtils";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { MeetingContactTitleSync } from "@/modules/meetings/meetingFormUtils";
import { MeetingVideoCallSection } from "@/modules/meetings/MeetingVideoCallSection";
import { QuickMeetingContactCreateDialog } from "@/modules/meetings/QuickMeetingContactCreateDialog";
import { sendMeetingShareNotifications } from "@/modules/meetings/sendMeetingShareNotifications";
import { cn } from "@/lib/utils";
import { useOrganizationMeetingNotificationSettings } from "@/modules/settings/useOrganizationMeetingNotificationSettings";
import { DEFAULT_MEETING_NOTIFICATION_SETTINGS } from "@/modules/meetings/meetingNotificationSettings";
import { TeamMemberMultiSelect } from "@/modules/shared/TeamMemberMultiSelect";

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
        <AvatarFallback className="bg-info/15 text-sm font-semibold text-info">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[email, phone !== "No phone" ? phone : null]
            .filter(Boolean)
            .join(" ·")}
        </p>
      </div>
      <IconButton
        className="shrink-0 text-muted-foreground"
        onClick={onClear}
        aria-label="Change contact"
      >
        <X className="size-4" />
      </IconButton>
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
  const config = useConfigurationContext();
  const { smsEnabled } = useMessagingEnabled();
  const { data: meetingNotifySettings } =
    useOrganizationMeetingNotificationSettings(open);
  const workspaceTimezone =
    String(config.companyTimezone ?? "").trim() || DEFAULT_ORG_TIMEZONE;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareEmail, setShareEmail] = useState(
    DEFAULT_MEETING_NOTIFICATION_SETTINGS.client_invite_email_default,
  );
  const [shareSms, setShareSms] = useState(
    DEFAULT_MEETING_NOTIFICATION_SETTINGS.client_invite_sms_default,
  );
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
      // Pre-fill assignees with the current user so avatars render immediately.
      assignee_member_ids: identity?.id != null ? [identity.id] : [],
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
      return;
    }
    const defaults =
      meetingNotifySettings ?? DEFAULT_MEETING_NOTIFICATION_SETTINGS;
    setShareEmail(defaults.client_invite_email_default);
    setShareSms(defaults.client_invite_sms_default);
  }, [open, meetingNotifySettings]);

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
      notify("Choose a contact to generate the video link", {
        type: "warning",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = prepareCalendarEventWriteData(
        {
          ...values,
          event_date: toDateKey(new Date()),
          event_time: roundToNextFiveMinutes(new Date()),
          organization_member_id: identity.id,
          timezone: workspaceTimezone,
        },
        { defaultTimezone: workspaceTimezone },
      );

      const created = await dataProvider.create("calendar_events", {
        data: payload,
      });

      refresh();
      onOpenChange(false);
      window.open(meetingUrl, "_blank", "noopener,noreferrer");

      notify("Call started", { type: "success" });

      // Don't block the UI on email/SMS delivery; notifications can be slow.
      void sendMeetingShareNotifications({
        record: created.data as Record<string, unknown>,
        shareEmail,
        shareSms,
        dataProvider,
        notify,
      }).then(({ errors }) => {
        if (errors.length > 0) {
          notify(errors.join("."), { type: "warning" });
        }
      });
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
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [createContactSeed, setCreateContactSeed] = useState("");
  const contactId = useWatch({ name: "contact_id" }) as Identifier | null;
  const meetingUrl = useWatch({ name: "meeting_url" }) as string | null;

  const openCreateContact = (searchText?: string) => {
    setCreateContactSeed(searchText?.trim() ?? "");
    setCreateContactOpen(true);
  };

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
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
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
          <ReferenceInput source="contact_id" reference="contacts_summary">
            <AutocompleteInput
              label="Contact"
              labelVariant="floating"
              optionText={contactOptionText}
              inputText={contactOptionText}
              helperText={false}
              modal
              autoFocus
              placeholder="Search contact…"
              validate={(value) => (value ? undefined : "Required")}
              filterToQuery={(searchText) => ({ q: searchText })}
              createItemLabel={(filter) => `Add "${filter}" as new contact`}
              onCreate={(filter) => {
                openCreateContact(filter);
                return undefined;
              }}
            />
          </ReferenceInput>
        )}

        <TeamMemberMultiSelect
          source="assignee_member_ids"
          label="Team"
          required
          placeholder="Select meeting assignees"
        />

        <CreateFormFieldRow>
          <SelectInput
            source="duration_minutes"
            label="Duration"
            labelVariant="floating"
            choices={[...DURATION_CHOICES]}
            format={formatDuration}
            parse={parseDuration}
            helperText={false}
          />
          <SelectInput
            source="remind_before_minutes"
            label="Reminder"
            labelVariant="floating"
            choices={[...REMIND_BEFORE_CHOICES]}
            format={formatRemindBefore}
            parse={parseRemindBefore}
            helperText={false}
          />
        </CreateFormFieldRow>

        <ReferenceInput source="deal_id" reference="deals">
          <AutocompleteInput
            label="Project (optional)"
            labelVariant="floating"
            optionText={dealOptionText}
            helperText={false}
            modal
            placeholder="Search project…"
            filterToQuery={(searchText) => ({ q: searchText })}
          />
        </ReferenceInput>

        <TextInput
          source="description"
          label="Notes"
          labelVariant="floating"
          multiline
          helperText={false}
          placeholder="Agenda, context…"
        />

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

      <QuickMeetingContactCreateDialog
        open={createContactOpen}
        onOpenChange={setCreateContactOpen}
        initialName={createContactSeed}
        onCreated={(created) => {
          setValue("contact_id", created.id as Identifier, {
            shouldDirty: true,
          });
          setValue("meeting_url", null, { shouldDirty: true });
        }}
      />
    </>
  );
};
