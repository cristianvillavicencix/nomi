import { useEffect, useState } from "react";
import {
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
import { SaveButton } from "@/components/admin/form";
import { DateInput } from "@/components/admin/date-input";
import { TextInput } from "@/components/admin/text-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { SelectInput } from "@/components/admin/select-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CalendarEventRecord } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { CalendarEventDeleteButton } from "@/modules/calendar/CalendarEventDeleteButton";
import { CalendarEventFormInitializer } from "@/modules/calendar/CalendarEventFormInitializer";
import { prepareCalendarEventWriteData } from "@/modules/calendar/calendarEventWriteData";
import { CalendarTimeInput } from "@/modules/calendar/CalendarTimeInput";
import {
  DURATION_CHOICES,
  DURATION_NONE,
} from "@/modules/calendar/calendarReminderOptions";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/timezone/usTimezone";
import { MeetingScheduleForm } from "@/modules/meetings/MeetingScheduleForm";
import { sendMeetingShareNotifications } from "@/modules/meetings/sendMeetingShareNotifications";
import { sendCalendarEventUpdateNotifications } from "@/modules/calendar/sendCalendarEventUpdateNotifications";
import { DEFAULT_MEETING_NOTIFICATION_SETTINGS } from "@/modules/meetings/meetingNotificationSettings";
import { useOrganizationMeetingNotificationSettings } from "@/modules/settings/useOrganizationMeetingNotificationSettings";
import {
  isMeetingCreateCategory,
  type WorkCreateCategory,
} from "@/modules/work/workCreateCategories";
import { CalendarReminderOffsetsInput } from "@/modules/calendar/CalendarReminderOffsetsInput";
import { TeamMemberMultiSelect } from "@/modules/shared/TeamMemberMultiSelect";
import { WorkCreateAccountLinkFields } from "@/modules/work/WorkCreateAccountLinkFields";
import { WorkCreateDialog } from "@/modules/work/WorkCreateDialog";

const formatDuration = (value?: number | null) =>
  value == null ? DURATION_NONE : value;

const parseDuration = (value: string | number) => {
  if (value === DURATION_NONE || value === "" || value == null) return null;
  return Number(value);
};

const CalendarEventEditForm = ({
  isMeeting,
  onDeleteSuccess,
  onDeleteError,
}: {
  isMeeting: boolean;
  onDeleteSuccess?: () => void;
  onDeleteError?: (error: unknown) => void;
}) => {
  if (isMeeting) {
    return (
      <MeetingScheduleForm
        isEdit
        onDeleteSuccess={onDeleteSuccess}
        onDeleteError={onDeleteError}
      />
    );
  }

  return (
    <Form className="flex flex-col gap-4">
      <CalendarEventFormInitializer />
      <DialogHeader>
        <DialogTitle>Edit event</DialogTitle>
      </DialogHeader>

      <TextInput
        source="title"
        label="Title"
        validate={required()}
        autoFocus
        labelVariant="floating"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <DateInput
          source="event_date"
          label="Date"
          validate={required()}
          labelVariant="floating"
        />
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
        helperText="How long the event lasts"
        labelVariant="floating"
      />
      <CalendarReminderOffsetsInput />
      <TextInput
        source="description"
        label="Notes"
        multiline
        helperText={false}
        labelVariant="floating"
      />

      <div className="space-y-3 rounded-md border p-3">
        <WorkCreateAccountLinkFields />
        <TeamMemberMultiSelect
          source="assignee_member_ids"
          label="Team members"
          required
        />
      </div>

      <BooleanInput
        source="completed_at"
        label="Mark as done"
        format={(value) => Boolean(value)}
        parse={(value) => (value ? new Date().toISOString() : null)}
        helperText={false}
      />

      <DialogFooter className="w-full sm:justify-between gap-4">
        <CalendarEventDeleteButton
          onSuccess={onDeleteSuccess}
          onError={onDeleteError}
        />
        <SaveButton type="button" label="Save" />
      </DialogFooter>
    </Form>
  );
};

export const CalendarEventSheet = ({
  open,
  onOpenChange,
  dateKey,
  initialTime = null,
  initialCategory = "task",
  dealId,
  editEventId = null,
  editIsMeeting = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateKey: string;
  initialTime?: string | null;
  initialCategory?: WorkCreateCategory;
  dealId?: Identifier;
  editEventId?: Identifier | null;
  editIsMeeting?: boolean;
}) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const config = useConfigurationContext();
  const workspaceTimezone =
    String(config.companyTimezone ?? "").trim() || DEFAULT_ORG_TIMEZONE;
  const isEdit = editEventId != null;
  const [category, setCategory] = useState<WorkCreateCategory>(initialCategory);

  const { data: meetingNotifySettings } =
    useOrganizationMeetingNotificationSettings(
      open && (isEdit ? editIsMeeting : isMeetingCreateCategory(category)),
    );
  const [shareEmail, setShareEmail] = useState(
    DEFAULT_MEETING_NOTIFICATION_SETTINGS.client_invite_email_default,
  );
  const [shareSms, setShareSms] = useState(
    DEFAULT_MEETING_NOTIFICATION_SETTINGS.client_invite_sms_default,
  );

  const { data: previousEvent } = useGetOne<CalendarEventRecord>(
    "calendar_events",
    { id: editEventId! },
    { enabled: open && isEdit && editEventId != null },
  );

  const { data: emailSettings } = useQuery({
    queryKey: ["email-delivery-settings"],
    queryFn: () => dataProvider.getEmailDeliverySettings(),
    enabled: open && !isEdit && isMeetingCreateCategory(category) && !!identity?.id,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open || isEdit) return;
    setCategory(initialCategory);
  }, [open, isEdit, initialCategory]);

  useEffect(() => {
    if (!open || isEdit) return;
    const defaults =
      meetingNotifySettings ?? DEFAULT_MEETING_NOTIFICATION_SETTINGS;
    setShareEmail(defaults.client_invite_email_default);
    setShareSms(defaults.client_invite_sms_default);
  }, [open, isEdit, meetingNotifySettings]);

  if (!identity || !open) return null;

  const closeSheet = () => {
    setCategory("task");
    onOpenChange(false);
  };

  const transformCalendarEvent = (data: Record<string, unknown>) =>
    prepareCalendarEventWriteData(
      {
        ...data,
        timezone: String(data.timezone ?? "").trim() || workspaceTimezone,
      },
      { defaultTimezone: workspaceTimezone },
    );

  const handleMutationError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Could not save calendar event";
    notify(message, { type: "error" });
  };

  const notifyMeetingShare = async (record: Record<string, unknown>) => {
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

  const handleTaskSuccess = async (data: Record<string, unknown>) => {
    closeSheet();
    refresh();
    if (data?.contact_id) {
      const contactRecord = await dataProvider.getOne("contacts", {
        id: data.contact_id as Identifier,
      });
      if (contactRecord.data) {
        await dataProvider.update("contacts", {
          id: contactRecord.data.id,
          data: { last_seen: new Date().toISOString() },
          previousData: contactRecord.data,
        });
      }
    }
    notify("Added to calendar");
  };

  const handleEventCreateSuccess = async (
    record?: Record<string, unknown>,
  ) => {
    if (isMeetingCreateCategory(category) && record) {
      await notifyMeetingShare(record);
    }
    closeSheet();
    refresh();
    notify(
      isMeetingCreateCategory(category) ? "Meeting scheduled" : "Event added",
    );
  };

  const handleEventEditSuccess = async (record?: Record<string, unknown>) => {
    const updated = (record ?? {}) as CalendarEventRecord;
    if (previousEvent) {
      const notifyDefaults =
        meetingNotifySettings ?? DEFAULT_MEETING_NOTIFICATION_SETTINGS;
      const { warnings } = await sendCalendarEventUpdateNotifications({
        previous: previousEvent,
        updated,
        dataProvider,
        notify,
        shareEmail: notifyDefaults.client_invite_email_default,
        shareSms: notifyDefaults.client_invite_sms_default,
      });
      if (warnings.length > 0) {
        notify(warnings.join(". "), { type: "warning" });
      }
    }
    closeSheet();
    refresh();
    notify(editIsMeeting ? "Meeting updated" : "Event updated");
  };

  const handleDeleteSuccess = () => {
    closeSheet();
    refresh();
  };

  const meetingFormProps = {
    emailConfigured: emailSettings?.configured === true,
    shareEmail,
    shareSms,
    onShareEmailChange: setShareEmail,
    onShareSmsChange: setShareSms,
    showShareOptions: true,
  };

  if (isEdit && editEventId != null) {
    return (
      <EditBase
        id={editEventId}
        resource="calendar_events"
        transform={transformCalendarEvent}
        mutationMode="pessimistic"
        mutationOptions={{
          onSuccess: (record) => {
            void handleEventEditSuccess(record as Record<string, unknown>);
          },
          onError: handleMutationError,
        }}
        redirect={false}
      >
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
            <CalendarEventEditForm
              isMeeting={editIsMeeting}
              onDeleteSuccess={handleDeleteSuccess}
              onDeleteError={handleMutationError}
            />
          </DialogContent>
        </Dialog>
      </EditBase>
    );
  }

  return (
    <WorkCreateDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeSheet();
        else onOpenChange(next);
      }}
      category={category}
      onCategoryChange={setCategory}
      dateKey={dateKey}
      initialTime={initialTime}
      dealId={dealId}
      memberId={identity.id}
      onTaskSuccess={handleTaskSuccess}
      onEventSuccess={handleEventCreateSuccess}
      transformCalendarEvent={transformCalendarEvent}
      meetingFormProps={meetingFormProps}
      onError={handleMutationError}
    />
  );
};
