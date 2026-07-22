import { DateInput } from "@/components/admin/date-input";
import { required } from "ra-core";
import { TaskDescriptionMentionInput } from "@/components/atomic-crm/tasks/TaskDescriptionMentionInput";
import { CalendarReminderOffsetsInput } from "@/modules/calendar/CalendarReminderOffsetsInput";
import { CalendarTimeInput } from "@/modules/calendar/CalendarTimeInput";
import { TeamMemberMultiSelect } from "@/modules/shared/TeamMemberMultiSelect";

export const TaskCoreFormFields = ({
  defaultDealId,
  rows = 3,
  autoFocus = true,
}: {
  defaultDealId?: string | number | null;
  rows?: number;
  autoFocus?: boolean;
}) => (
  <>
    <TaskDescriptionMentionInput
      autoFocus={autoFocus}
      source="text"
      label="Description"
      validate={required()}
      className="m-0"
      defaultDealId={defaultDealId}
      rows={rows}
    />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DateInput
        source="due_date"
        label="Date"
        helperText={false}
        validate={required()}
      />
      <CalendarTimeInput source="due_time" label="Time" helperText={false} />
    </div>
    <TeamMemberMultiSelect
      source="assignee_person_ids"
      label="Team members"
      required
    />
    <CalendarReminderOffsetsInput />
  </>
);
