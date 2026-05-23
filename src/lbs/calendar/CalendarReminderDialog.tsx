import {
  CreateBase,
  EditBase,
  Form,
  required,
  useGetIdentity,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import { DeleteButton } from "@/components/admin/delete-button";
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
import type { Contact } from "@/components/atomic-crm/types";
import { getPersonOptionText } from "@/components/atomic-crm/tasks/taskPeopleOptions";
import { prepareCalendarEventWriteData } from "@/lbs/calendar/calendarEventWriteData";
import { CalendarTimeInput } from "@/lbs/calendar/CalendarTimeInput";
import {
  getContactDisplayName,
  DURATION_CHOICES,
  DURATION_NONE,
  REMIND_BEFORE_CHOICES,
  REMIND_BEFORE_NONE,
} from "@/lbs/calendar/calendarReminderOptions";
import { MeetingScheduleForm } from "@/lbs/meetings/MeetingScheduleForm";

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
      <ReferenceInput
        source="person_id"
        reference="people"
        filter={{ "status@eq": "active" }}
      >
        <AutocompleteInput
          label="Assigned"
          optionText={getPersonOptionText}
          helperText={false}
          modal
          filterToQuery={(searchText) => ({ q: searchText })}
        />
      </ReferenceInput>
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
        <DeleteButton
          mutationOptions={{
            onSuccess: onDeleteSuccess,
            onError: onDeleteError,
          }}
          redirect={false}
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
  const isEdit = reminderId != null;

  if (!identity) return null;

  const closeDialog = () => onOpenChange(false);

  const handleMutationError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Could not save calendar event";
    notify(message, { type: "error" });
  };

  const handleCreateSuccess = () => {
    refresh();
    closeDialog();
    notify(variant === "meeting" ? "Meeting scheduled" : "Event added");
  };

  const handleEditSuccess = () => {
    refresh();
    closeDialog();
    notify(variant === "meeting" ? "Meeting updated" : "Event updated");
  };

  const FormComponent =
    variant === "meeting" ? MeetingScheduleForm : CalendarEventForm;

  const handleDeleteSuccess = () => {
    refresh();
    closeDialog();
    notify("Event deleted");
  };

  if (open && isEdit && reminderId != null) {
    return (
      <EditBase
        id={reminderId}
        resource="calendar_events"
        transform={prepareCalendarEventWriteData}
        mutationMode="pessimistic"
        mutationOptions={{
          onSuccess: handleEditSuccess,
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
          remind_before_minutes: 15,
          description: "",
          meeting_url: null,
          person_id: null,
          contact_id: null,
          deal_id: null,
          organization_member_id: identity.id,
          completed_at: null,
          ...initialRecord,
        }}
        transform={prepareCalendarEventWriteData}
        mutationMode="pessimistic"
        mutationOptions={{
          onSuccess: handleCreateSuccess,
          onError: handleMutationError,
        }}
        redirect={false}
      >
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
            <FormComponent isEdit={false} />
          </DialogContent>
        </Dialog>
      </CreateBase>
    );
  }

  return null;
};
