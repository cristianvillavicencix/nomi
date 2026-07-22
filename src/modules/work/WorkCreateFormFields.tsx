import { required } from "ra-core";
import { TextInput } from "@/components/admin/text-input";
import { DateInput } from "@/components/admin/date-input";
import { TaskCoreFormFields } from "@/components/atomic-crm/tasks/TaskCoreFormFields";
import { CalendarReminderOffsetsInput } from "@/modules/calendar/CalendarReminderOffsetsInput";
import { CalendarTimeInput } from "@/modules/calendar/CalendarTimeInput";
import { TeamMemberMultiSelect } from "@/modules/shared/TeamMemberMultiSelect";
import { WorkCreateAccountLinkFields } from "@/modules/work/WorkCreateAccountLinkFields";
import type { WorkCreateCategory } from "@/modules/work/workCreateCategories";

export const WorkCreateTaskFields = ({
  category: _category,
  defaultDealId,
}: {
  category: WorkCreateCategory;
  defaultDealId?: string | number | null;
}) => (
  <>
    <TaskCoreFormFields defaultDealId={defaultDealId} rows={3} />
    <WorkCreateAccountLinkFields />
  </>
);

export const WorkCreateEventFields = ({
  category: _category,
}: {
  category: WorkCreateCategory;
}) => (
  <>
    <TextInput
      source="title"
      label="Description"
      validate={required()}
      autoFocus
      helperText={false}
    />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DateInput
        source="event_date"
        label="Date"
        helperText={false}
        validate={required()}
      />
      <CalendarTimeInput
        source="event_time"
        label="Time"
        helperText={false}
      />
    </div>
    <TeamMemberMultiSelect
      source="assignee_member_ids"
      label="Team members"
      required
    />
    <CalendarReminderOffsetsInput />
    <div className="rounded-md border p-3">
      <WorkCreateAccountLinkFields title={null} />
    </div>
  </>
);
