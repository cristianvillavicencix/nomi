import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { required } from "ra-core";
import { TASK_PRIORITIES } from "@/components/atomic-crm/tasks/taskConstants";
import { TaskDescriptionMentionInput } from "@/components/atomic-crm/tasks/TaskDescriptionMentionInput";
import {
  TeamMemberCollaboratorSelect,
  TeamMemberMultiSelect,
} from "@/modules/shared/TeamMemberMultiSelect";

export const TaskFormContent = ({
  defaultDealId,
}: {
  selectContact?: boolean;
  contactFilter?: Record<string, string>;
  showAssignee?: boolean;
  showDealLink?: boolean;
  defaultDealId?: string | number | null;
}) => (
  <div className="flex flex-col gap-4">
    <TaskDescriptionMentionInput
      autoFocus
      source="text"
      label="Description"
      validate={required()}
      className="m-0"
      defaultDealId={defaultDealId}
      rows={4}
    />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DateInput source="due_date" helperText={false} validate={required()} />
      <SelectInput
        source="priority"
        label="Priority"
        choices={TASK_PRIORITIES}
        optionText="label"
        optionValue="value"
        helperText={false}
        defaultValue="normal"
      />
    </div>
    <TeamMemberMultiSelect
      source="assignee_person_ids"
      label="Assignees"
      required
    />
    <TeamMemberCollaboratorSelect />
  </div>
);
