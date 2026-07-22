import type { ReactNode } from "react";
import { Form } from "ra-core";
import { CalendarEventDeleteButton } from "@/modules/calendar/CalendarEventDeleteButton";
import { DateInput } from "@/components/admin/date-input";
import { SaveButton } from "@/components/admin/form";
import { TextInput } from "@/components/admin/text-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { SelectInput } from "@/components/admin/select-input";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { CalendarTimeInput } from "@/modules/calendar/CalendarTimeInput";
import {
  DURATION_CHOICES,
  DURATION_NONE,
} from "@/modules/calendar/calendarReminderOptions";
import { MeetingContactTitleSync } from "@/modules/meetings/meetingFormUtils";
import { MeetingFormatFields } from "@/modules/meetings/MeetingFormatFields";
import { MeetingShareOptions } from "@/modules/meetings/MeetingShareOptions";
import { CalendarReminderOffsetsInput } from "@/modules/calendar/CalendarReminderOffsetsInput";
import { TeamMemberMultiSelect } from "@/modules/shared/TeamMemberMultiSelect";
import { WorkCreateAccountLinkFields } from "@/modules/work/WorkCreateAccountLinkFields";

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

export const MeetingScheduleFormFields = ({
  isEdit,
  embedded = false,
  onDeleteSuccess,
  onDeleteError,
  emailConfigured = false,
  shareEmail = false,
  shareSms = false,
  onShareEmailChange,
  onShareSmsChange,
  showShareOptions = false,
}: {
  isEdit: boolean;
  embedded?: boolean;
  onDeleteSuccess?: () => void;
  onDeleteError?: (error: unknown) => void;
  emailConfigured?: boolean;
  shareEmail?: boolean;
  shareSms?: boolean;
  onShareEmailChange?: (value: boolean) => void;
  onShareSmsChange?: (value: boolean) => void;
  showShareOptions?: boolean;
}) => {
  return (
    <>
      <MeetingContactTitleSync />

      {!embedded ? (
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit meeting" : "Schedule meeting"}
          </DialogTitle>
        </DialogHeader>
      ) : null}

      <Table>
        <TableBody>
          <WorkCreateAccountLinkFields
            requireContact
            showCreateContact
            title={null}
            renderRow={(label, children) => (
              <MeetingFormRow label={label}>{children}</MeetingFormRow>
            )}
          />

          <MeetingFormRow label="Team">
            <TeamMemberMultiSelect
              source="assignee_member_ids"
              label={false}
              required
              placeholder="Select meeting assignees"
            />
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
            <CalendarTimeInput
              source="event_time"
              label={false}
              helperText={false}
            />
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

          <MeetingFormRow label="Reminders">
            <CalendarReminderOffsetsInput label={false} showLabel={false} />
          </MeetingFormRow>

          <MeetingFormRow label="Notes">
            <TextInput
              source="description"
              label={false}
              multiline
              helperText={false}
            />
          </MeetingFormRow>

          <MeetingFormRow label="Where">
            <MeetingFormatFields />
          </MeetingFormRow>
        </TableBody>
      </Table>

      {showShareOptions && onShareEmailChange && onShareSmsChange ? (
        <MeetingShareOptions
          emailConfigured={emailConfigured}
          shareEmail={shareEmail}
          shareSms={shareSms}
          onShareEmailChange={onShareEmailChange}
          onShareSmsChange={onShareSmsChange}
        />
      ) : null}

      {isEdit && !embedded ? (
        <BooleanInput
          source="completed_at"
          label="Mark as done"
          format={(value) => Boolean(value)}
          parse={(value) => (value ? new Date().toISOString() : null)}
          helperText={false}
        />
      ) : null}

      {!embedded ? (
        <DialogFooter className="w-full sm:justify-between gap-4">
          {isEdit ? (
            <CalendarEventDeleteButton
              onSuccess={onDeleteSuccess}
              onError={onDeleteError}
              label="Delete meeting"
            />
          ) : (
            <span />
          )}
          <SaveButton
            type="button"
            label={isEdit ? "Save meeting" : "Schedule meeting"}
          />
        </DialogFooter>
      ) : null}
    </>
  );
};

export type MeetingScheduleFormFieldsProps = {
  isEdit: boolean;
  embedded?: boolean;
  onDeleteSuccess?: () => void;
  onDeleteError?: (error: unknown) => void;
  emailConfigured?: boolean;
  shareEmail?: boolean;
  shareSms?: boolean;
  onShareEmailChange?: (value: boolean) => void;
  onShareSmsChange?: (value: boolean) => void;
  showShareOptions?: boolean;
};

export const MeetingScheduleForm = ({
  isEdit,
  onDeleteSuccess,
  onDeleteError,
  emailConfigured = false,
  shareEmail = false,
  shareSms = false,
  onShareEmailChange,
  onShareSmsChange,
  showShareOptions = false,
}: {
  isEdit: boolean;
  onDeleteSuccess?: () => void;
  onDeleteError?: (error: unknown) => void;
  emailConfigured?: boolean;
  shareEmail?: boolean;
  shareSms?: boolean;
  onShareEmailChange?: (value: boolean) => void;
  onShareSmsChange?: (value: boolean) => void;
  showShareOptions?: boolean;
}) => (
  <Form className="flex flex-col gap-4">
    <MeetingScheduleFormFields
      isEdit={isEdit}
      onDeleteSuccess={onDeleteSuccess}
      onDeleteError={onDeleteError}
      emailConfigured={emailConfigured}
      shareEmail={shareEmail}
      shareSms={shareSms}
      onShareEmailChange={onShareEmailChange}
      onShareSmsChange={onShareSmsChange}
      showShareOptions={showShareOptions}
    />
  </Form>
);
