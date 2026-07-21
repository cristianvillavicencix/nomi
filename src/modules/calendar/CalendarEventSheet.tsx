import { useEffect, useState, type ReactNode } from "react";
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
import { DialogSaveButton } from "@/components/admin/form-guard";
import { SaveButton } from "@/components/admin/form";
import { DateInput } from "@/components/admin/date-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { SelectInput } from "@/components/admin/select-input";
import { normalizeTaskCreateData } from "@/components/atomic-crm/tasks/taskConstants";
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
import { CalendarEventDeleteButton } from "@/modules/calendar/CalendarEventDeleteButton";
import { prepareCalendarEventWriteData } from "@/modules/calendar/calendarEventWriteData";
import { CalendarTimeInput } from "@/modules/calendar/CalendarTimeInput";
import {
  DEFAULT_MEETING_DURATION_MINUTES,
  DURATION_CHOICES,
  DURATION_NONE,
  getContactDisplayName,
  REMIND_BEFORE_CHOICES,
  REMIND_BEFORE_NONE,
} from "@/modules/calendar/calendarReminderOptions";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/timezone/usTimezone";
import { MeetingScheduleForm } from "@/modules/meetings/MeetingScheduleForm";
import { sendMeetingShareNotifications } from "@/modules/meetings/sendMeetingShareNotifications";
import { sendCalendarEventUpdateNotifications } from "@/modules/calendar/sendCalendarEventUpdateNotifications";
import { DEFAULT_MEETING_NOTIFICATION_SETTINGS } from "@/modules/meetings/meetingNotificationSettings";
import { useOrganizationMeetingNotificationSettings } from "@/modules/settings/useOrganizationMeetingNotificationSettings";
import {
  isMeetingWorkCategory,
  isTaskWorkCategory,
  WorkCreateCategoryPicker,
} from "@/modules/work/WorkCreateCategoryPicker";
import {
  WorkCreateEventFields,
  WorkCreateTaskFields,
} from "@/modules/work/WorkCreateFormFields";
import type { WorkCategory } from "@/modules/work/workTypes";

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

const getCategoryHint = (category: WorkCategory) => {
  if (category === "task") return "Task shows due date and priority.";
  if (category === "meeting") return "Video call with optional client invite.";
  if (category === "delivery") return "Delivery uses date only — no time.";
  if (category === "activity") return "Activity can be linked to a contact or project.";
  return "Follow up uses a due date and optional time.";
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
      <DialogHeader>
        <DialogTitle>Edit event</DialogTitle>
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
        helperText="How long the event lasts"
      />
      <SelectInput
        source="remind_before_minutes"
        label="Remind me"
        choices={[...REMIND_BEFORE_CHOICES]}
        format={formatRemindBefore}
        parse={parseRemindBefore}
        helperText="Alert before the scheduled time"
      />
      <TextInput
        source="description"
        label="Notes"
        multiline
        helperText={false}
      />

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Link to (optional)</p>
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
        <ReferenceInput
          source="organization_member_id"
          reference="organization_members"
        >
          <AutocompleteInput
            label="Assigned"
            optionText={memberOptionText}
            inputText={memberOptionText}
            helperText={false}
            modal
            filterToQuery={(searchText) => ({ q: searchText })}
          />
        </ReferenceInput>
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

const CalendarEventCreateShell = ({
  category,
  onCategoryChange,
  dealId,
  categoryHint,
  children,
}: {
  category: WorkCategory;
  onCategoryChange: (next: WorkCategory) => void;
  dealId?: Identifier;
  categoryHint: string;
  children: ReactNode;
}) => (
  <DialogContent className="top-1/20 max-h-9/10 translate-y-0 overflow-y-auto lg:max-w-xl">
    <Form className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Add to calendar</DialogTitle>
      </DialogHeader>
      <WorkCreateCategoryPicker value={category} onChange={onCategoryChange} />
      {children}
      <p className="rounded-sm border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        {categoryHint}
      </p>
      <DialogFooter className="w-full justify-end gap-2">
        <DialogSaveButton label="Create" />
      </DialogFooter>
    </Form>
  </DialogContent>
);

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
  initialCategory?: WorkCategory;
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
  const [category, setCategory] = useState<WorkCategory>(initialCategory);

  const { data: meetingNotifySettings } =
    useOrganizationMeetingNotificationSettings(
      open && (isEdit ? editIsMeeting : category === "meeting"),
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
    enabled: open && !isEdit && category === "meeting" && !!identity?.id,
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
    if (category === "meeting" && record) {
      await notifyMeetingShare(record);
    }
    closeSheet();
    refresh();
    notify(category === "meeting" ? "Meeting scheduled" : "Event added");
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

  if (isTaskWorkCategory(category)) {
    return (
      <CreateBase
        key={`task-${category}-${dateKey}-${initialTime ?? ""}`}
        resource="tasks"
        record={{
          type: "none",
          deal_id: dealId ?? null,
          due_date: dateKey,
          organization_member_id: identity.id,
          assignee_person_ids: [],
          collaborator_person_ids: [],
          priority: "normal",
          internal: false,
        }}
        transform={(data) => {
          const normalized = normalizeTaskCreateData({
            ...data,
            deal_id: dealId ?? data.deal_id ?? null,
          });
          const assigneeId = Number(data.organization_member_id);
          if (
            Number.isFinite(assigneeId) &&
            (normalized.assignee_person_ids?.length ?? 0) === 0
          ) {
            normalized.assignee_person_ids = [assigneeId];
          }
          return normalized;
        }}
        mutationOptions={{ onSuccess: handleTaskSuccess }}
      >
        <Dialog open={open} onOpenChange={onOpenChange}>
          <CalendarEventCreateShell
            category={category}
            onCategoryChange={setCategory}
            dealId={dealId}
            categoryHint={getCategoryHint(category)}
          >
            <WorkCreateTaskFields category={category} defaultDealId={dealId} />
          </CalendarEventCreateShell>
        </Dialog>
      </CreateBase>
    );
  }

  if (isMeetingWorkCategory(category)) {
    return (
      <CreateBase
        key={`meeting-${dateKey}-${initialTime ?? ""}`}
        resource="calendar_events"
        record={{
          title: "",
          event_date: dateKey,
          event_time: initialTime,
          duration_minutes: DEFAULT_MEETING_DURATION_MINUTES,
          remind_before_minutes: 15,
          description: "",
          meeting_url: null,
          contact_id: null,
          deal_id: dealId ?? null,
          organization_member_id: identity.id,
          completed_at: null,
        }}
        transform={transformCalendarEvent}
        mutationMode="pessimistic"
        mutationOptions={{
          onSuccess: (record) => {
            void handleEventCreateSuccess(record as Record<string, unknown>);
          },
          onError: handleMutationError,
        }}
        redirect={false}
      >
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="flex flex-col gap-4">
              <WorkCreateCategoryPicker
                value={category}
                onChange={setCategory}
              />
              <MeetingScheduleForm isEdit={false} {...meetingFormProps} />
            </div>
          </DialogContent>
        </Dialog>
      </CreateBase>
    );
  }

  return (
    <CreateBase
      key={`event-${category}-${dateKey}-${initialTime ?? ""}`}
      resource="calendar_events"
      record={{
        title: "",
        event_date: dateKey,
        event_time: initialTime,
        duration_minutes: null,
        remind_before_minutes: category === "follow_up" ? 15 : null,
        description: "",
        contact_id: null,
        deal_id: dealId ?? null,
        organization_member_id: identity.id,
        completed_at: null,
      }}
      transform={transformCalendarEvent}
      mutationMode="pessimistic"
      mutationOptions={{
        onSuccess: (record) => {
          void handleEventCreateSuccess(record as Record<string, unknown>);
        },
        onError: handleMutationError,
      }}
      redirect={false}
    >
      <Dialog open={open} onOpenChange={onOpenChange}>
        <CalendarEventCreateShell
          category={category}
          onCategoryChange={setCategory}
          dealId={dealId}
          categoryHint={getCategoryHint(category)}
        >
          <WorkCreateEventFields category={category} />
        </CalendarEventCreateShell>
      </Dialog>
    </CreateBase>
  );
};
