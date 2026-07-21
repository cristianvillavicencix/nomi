import { useEffect, useState } from "react";
import {
  CreateBase,
  EditBase,
  Form,
  required,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import { useQuery } from "@tanstack/react-query";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { CalendarEventDeleteButton } from "@/modules/calendar/CalendarEventDeleteButton";
import { DateInput } from "@/components/admin/date-input";
import { SaveButton } from "@/components/admin/form";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { SelectInput } from "@/components/admin/select-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  CalendarEventRecord,
  Contact,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { formatOrganizationMemberName } from "@/modules/billing/billingUtils";
import { prepareCalendarEventWriteData } from "@/modules/calendar/calendarEventWriteData";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/timezone/usTimezone";
import { CalendarTimeInput } from "@/modules/calendar/CalendarTimeInput";
import {
  getContactDisplayName,
  DURATION_CHOICES,
  DURATION_NONE,
  REMIND_BEFORE_CHOICES,
  REMIND_BEFORE_NONE,
} from "@/modules/calendar/calendarReminderOptions";
import { MeetingScheduleForm } from "@/modules/meetings/MeetingScheduleForm";
import { sendMeetingShareNotifications } from "@/modules/meetings/sendMeetingShareNotifications";
import { sendCalendarEventUpdateNotifications } from "@/modules/calendar/sendCalendarEventUpdateNotifications";
import { useOrganizationMeetingNotificationSettings } from "@/modules/settings/useOrganizationMeetingNotificationSettings";
import { CalendarReminderOffsetsInput } from "@/modules/calendar/CalendarReminderOffsetsInput";
import { TeamMemberMultiSelect } from "@/modules/shared/TeamMemberMultiSelect";

const dealOptionText = (choice: {
  name?: string | null;
  id?: number | string;
}) => choice.name?.trim() || `Project #${choice.id}`;

const contactOptionText = (contact: Contact) => getContactDisplayName(contact);

const memberOptionText = (member: OrganizationMember) =>
  formatOrganizationMemberName(member) ?? `Member #${member.id}`;

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

const CalendarEventForm = ({
  isEdit,
  onDeleteSuccess,
  onDeleteError,
}: {
  isEdit: boolean;
  onDeleteSuccess?: () => void;
  onDeleteError?: (error: unknown) => void;
}) => (
  <Form className="flex flex-col gap-4">
    <DialogHeader>
      <DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
    </DialogHeader>

    <TextInput source="title" label="Title" validate={required()} autoFocus />
    <div className="grid gap-4 sm:grid-cols-2">
      <DateInput source="event_date" label="Date" validate={required()} />
      <CalendarTimeInput
        source="event_time"
        label="Start time"
        helperText={false}
      />
    </div>
    <SelectInput
      source="duration_minutes"
      label="Duration"
      choices={[...DURATION_CHOICES]}
      format={formatDuration}
      parse={parseDuration}
      helperText="How long the meeting or event lasts"
    />
    <CalendarReminderOffsetsInput />
    <TextInput
      source="description"
      label="Notes"
      multiline
      helperText={false}
    />

    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Link to (optional)</p>
      <p className="text-xs text-muted-foreground">
        Contact or project links create an activity. Assigned creates a task.
      </p>
      <ReferenceInput source="contact_id" reference="contacts_summary">
        <AutocompleteInput
          label="Contact"
          optionText={contactOptionText}
          inputText={contactOptionText}
          helperText={false}
          modal
          filterToQuery={(searchText) => ({ q: searchText })}
        />
      </ReferenceInput>
      <ReferenceInput source="deal_id" reference="deals">
        <AutocompleteInput
          label="Project"
          optionText={dealOptionText}
          helperText={false}
          modal
          filterToQuery={(searchText) => ({ q: searchText })}
        />
      </ReferenceInput>
      <TeamMemberMultiSelect
        source="assignee_member_ids"
        label="Assignees"
        required
      />
    </div>

    {isEdit ? (
      <BooleanInput
        source="completed_at"
        label="Mark as done"
        format={(value) => Boolean(value)}
        parse={(value) => (value ? new Date().toISOString() : null)}
        helperText={false}
      />
    ) : null}

    <DialogFooter className="w-full sm:justify-between gap-4">
      {isEdit ? (
        <CalendarEventDeleteButton
          onSuccess={onDeleteSuccess}
          onError={onDeleteError}
        />
      ) : (
        <span />
      )}
      <SaveButton type="button" label={isEdit ? "Save" : "Add event"} />
    </DialogFooter>
  </Form>
);

export const CalendarReminderDialog = ({
  open,
  onOpenChange,
  dateKey,
  reminderId = null,
  initialRecord,
  variant = "event",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateKey: string;
  reminderId?: Identifier | null;
  initialRecord?: Record<string, unknown>;
  variant?: "event" | "meeting";
}) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const config = useConfigurationContext();
  const workspaceTimezone =
    String(config.companyTimezone ?? "").trim() || DEFAULT_ORG_TIMEZONE;
  const isEdit = reminderId != null;
  const { data: meetingNotifySettings } =
    useOrganizationMeetingNotificationSettings(open && variant === "meeting");
  const [shareEmail, setShareEmail] = useState(
    DEFAULT_MEETING_NOTIFICATION_SETTINGS.client_invite_email_default,
  );
  const [shareSms, setShareSms] = useState(
    DEFAULT_MEETING_NOTIFICATION_SETTINGS.client_invite_sms_default,
  );

  const { data: previousEvent } = useGetOne<CalendarEventRecord>(
    "calendar_events",
    { id: reminderId! },
    { enabled: open && isEdit && reminderId != null },
  );

  const transformCalendarEvent = (data: Record<string, unknown>) =>
    prepareCalendarEventWriteData(
      {
        ...data,
        timezone:
          String(data.timezone ?? "").trim() || workspaceTimezone,
      },
      { defaultTimezone: workspaceTimezone },
    );

  const { data: emailSettings } = useQuery({
    queryKey: ["email-delivery-settings"],
    queryFn: () => dataProvider.getEmailDeliverySettings(),
    enabled: open && variant === "meeting" && !!identity?.id,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    const defaults =
      meetingNotifySettings ?? DEFAULT_MEETING_NOTIFICATION_SETTINGS;
    setShareEmail(defaults.client_invite_email_default);
    setShareSms(defaults.client_invite_sms_default);
  }, [open, meetingNotifySettings]);

  if (!identity) return null;

  const closeDialog = () => onOpenChange(false);

  const handleMutationError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Could not save calendar event";
    notify(message, { type: "error" });
  };

  const notifyMeetingShare = async (record: Record<string, unknown>) => {
    if (variant !== "meeting") return;

    const { errors } = await sendMeetingShareNotifications({
      record,
      shareEmail,
      shareSms,
      dataProvider,
      notify,
    });

    if (errors.length > 0) {
      notify(errors.join(". "), { type: "warning" });
    }
  };

  const handleCreateSuccess = async (record?: Record<string, unknown>) => {
    if (record) {
      await notifyMeetingShare(record);
    }
    refresh();
    closeDialog();
    notify(variant === "meeting" ? "Meeting scheduled" : "Event added");
  };

  const handleEditSuccess = async (record?: Record<string, unknown>) => {
    const updated = (record ?? {}) as CalendarEventRecord;
    if (previousEvent) {
      const notifyDefaults =
        meetingNotifySettings ?? DEFAULT_MEETING_NOTIFICATION_SETTINGS;
      const { warnings } = await sendCalendarEventUpdateNotifications({
        previous: previousEvent,
        updated,
        dataProvider,
        notify,
        shareEmail:
          variant === "meeting"
            ? notifyDefaults.client_invite_email_default
            : false,
        shareSms:
          variant === "meeting"
            ? notifyDefaults.client_invite_sms_default
            : false,
      });
      if (warnings.length > 0) {
        notify(warnings.join(". "), { type: "warning" });
      }
    }
    refresh();
    closeDialog();
    notify(variant === "meeting" ? "Meeting updated" : "Event updated");
  };

  const meetingFormProps =
    variant === "meeting"
      ? {
          emailConfigured: emailSettings?.configured === true,
          shareEmail,
          shareSms,
          onShareEmailChange: setShareEmail,
          onShareSmsChange: setShareSms,
          showShareOptions: !isEdit,
        }
      : {};

  const FormComponent =
    variant === "meeting" ? MeetingScheduleForm : CalendarEventForm;

  const handleDeleteSuccess = () => {
    refresh();
    closeDialog();
  };

  if (open && isEdit && reminderId != null) {
    return (
      <EditBase
        id={reminderId}
        resource="calendar_events"
        transform={transformCalendarEvent}
        mutationMode="pessimistic"
        mutationOptions={{
          onSuccess: (record) => {
            void handleEditSuccess(record as Record<string, unknown>);
          },
          onError: handleMutationError,
        }}
        redirect={false}
      >
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
            <FormComponent
              isEdit
              onDeleteSuccess={handleDeleteSuccess}
              onDeleteError={handleMutationError}
              {...meetingFormProps}
            />
          </DialogContent>
        </Dialog>
      </EditBase>
    );
  }

  if (open) {
    return (
      <CreateBase
        key={dateKey}
        resource="calendar_events"
        record={{
          title: "",
          event_date: dateKey,
          event_time: null,
          duration_minutes: null,
          reminder_offsets_minutes: [15],
          remind_before_minutes: 15,
          description: "",
          meeting_url: null,
          contact_id: null,
          deal_id: null,
          organization_member_id: identity.id,
          assignee_member_ids: [identity.id],
          completed_at: null,
          ...initialRecord,
        }}
        transform={transformCalendarEvent}
        mutationMode="pessimistic"
        mutationOptions={{
          onSuccess: (record) => {
            void handleCreateSuccess(record as Record<string, unknown>);
          },
          onError: handleMutationError,
        }}
        redirect={false}
      >
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
            <FormComponent isEdit={false} {...meetingFormProps} />
          </DialogContent>
        </Dialog>
      </CreateBase>
    );
  }

  return null;
};
