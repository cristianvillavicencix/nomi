import type { ReactNode } from "react";
import { DeleteButton } from "@/components/admin/delete-button";
import { DateInput } from "@/components/admin/date-input";
import { SaveButton } from "@/components/admin/form";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { SelectInput } from "@/components/admin/select-input";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import type { Contact } from "@/components/atomic-crm/types";
import { CalendarTimeInput } from "@/lbs/calendar/CalendarTimeInput";
import {
  getContactDisplayName,
  DURATION_CHOICES,
  DURATION_NONE,
  REMIND_BEFORE_CHOICES,
  REMIND_BEFORE_NONE,
} from "@/lbs/calendar/calendarReminderOptions";
import { MeetingContactTitleSync } from "@/lbs/meetings/meetingFormUtils";
import { MeetingVideoCallSection } from "@/lbs/meetings/MeetingVideoCallSection";
import { Form } from "ra-core";

const dealOptionText = (choice: { name?: string | null; id?: number | string }) =>
  choice.name?.trim() || `Project #${choice.id}`;

const contactOptionText = (contact: Contact) => getContactDisplayName(contact);

const formatRemindBefore = (value?: number | null) =>
  value == null ? REMIND_BEFORE_NONE : value;

const parseRemindBefore = (value: string | number) => {
  if (value === REMIND_BEFORE_NONE || value === "" || value == null) return null;
  return Number(value);
};

const formatDuration = (value?: number | null) =>
  value == null ? DURATION_NONE : value;

const parseDuration = (value: string | number) => {
  if (value === DURATION_NONE || value === "" || value == null) return null;
  return Number(value);
};

const MeetingFormRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <TableRow className="hover:bg-transparent">
    <TableCell className="w-36 py-3 align-top font-medium text-muted-foreground">
      {label}
    </TableCell>
    <TableCell className="py-3">{children}</TableCell>
  </TableRow>
);

export const MeetingScheduleForm = ({
  isEdit,
  onDeleteSuccess,
  onDeleteError,
}: {
  isEdit: boolean;
  onDeleteSuccess?: () => void;
  onDeleteError?: (error: unknown) => void;
}) => (
  <Form className="flex flex-col gap-4">
    <MeetingContactTitleSync />

    <DialogHeader>
      <DialogTitle>{isEdit ? "Edit meeting" : "Schedule meeting"}</DialogTitle>
    </DialogHeader>

    <Table>
      <TableBody>
        <MeetingFormRow label="Contact">
          <ReferenceInput source="contact_id" reference="contacts_summary">
            <AutocompleteInput
              label={false}
              optionText={contactOptionText}
              inputText={contactOptionText}
              helperText={false}
              modal
              validate={(value) => (value ? undefined : "Required")}
              filterToQuery={(searchText) => ({ q: searchText })}
            />
          </ReferenceInput>
        </MeetingFormRow>

        <MeetingFormRow label="Project">
          <ReferenceInput source="deal_id" reference="deals">
            <AutocompleteInput
              label={false}
              optionText={dealOptionText}
              helperText={false}
              modal
              filterToQuery={(searchText) => ({ q: searchText })}
            />
          </ReferenceInput>
        </MeetingFormRow>

        <MeetingFormRow label="Title">
          <TextInput
            source="title"
            label={false}
            helperText={false}
            validate={(value) => (value?.trim() ? undefined : "Required")}
          />
        </MeetingFormRow>

        <MeetingFormRow label="Date">
          <DateInput
            source="event_date"
            label={false}
            validate={(value) => (value ? undefined : "Required")}
          />
        </MeetingFormRow>

        <MeetingFormRow label="Start time">
          <CalendarTimeInput source="event_time" label={false} helperText={false} />
        </MeetingFormRow>

        <MeetingFormRow label="Duration">
          <SelectInput
            source="duration_minutes"
            label={false}
            choices={[...DURATION_CHOICES]}
            format={formatDuration}
            parse={parseDuration}
            helperText={false}
          />
        </MeetingFormRow>

        <MeetingFormRow label="Remind me">
          <SelectInput
            source="remind_before_minutes"
            label={false}
            choices={[...REMIND_BEFORE_CHOICES]}
            format={formatRemindBefore}
            parse={parseRemindBefore}
            helperText={false}
          />
        </MeetingFormRow>

        <MeetingFormRow label="Notes">
          <TextInput source="description" label={false} multiline helperText={false} />
        </MeetingFormRow>

        <MeetingFormRow label="Video call">
          <MeetingVideoCallSection />
        </MeetingFormRow>
      </TableBody>
    </Table>

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
      <SaveButton type="button" label={isEdit ? "Save meeting" : "Schedule meeting"} />
    </DialogFooter>
  </Form>
);
