import { DateInput } from "@/components/admin/date-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { required } from "ra-core";
import { TASK_PRIORITIES } from "@/components/atomic-crm/tasks/taskConstants";
import { TaskDescriptionMentionInput } from "@/components/atomic-crm/tasks/TaskDescriptionMentionInput";
import { contactOptionText } from "../misc/ContactOption";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { OrganizationMember } from "../types";
import { isLbsMode } from "@/lbs/productMode";

const memberOptionText = (choice: OrganizationMember) =>
  `${choice.first_name} ${choice.last_name}`;

const dealOptionText = (choice: { name?: string | null; id?: number | string }) =>
  choice.name?.trim() || `Project #${choice.id}`;

export const TaskFormContent = ({
  selectContact,
  contactFilter,
  showAssignee = true,
  showDealLink,
  defaultDealId,
}: {
  selectContact?: boolean;
  contactFilter?: Record<string, string>;
  showAssignee?: boolean;
  showDealLink?: boolean;
  defaultDealId?: string | number | null;
}) => {
  const { taskTypes } = useConfigurationContext();
  const lbsMode = isLbsMode();
  const showOrgAssignee = showAssignee && !lbsMode;

  if (lbsMode) {
    return (
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TextInput
        autoFocus
        source="text"
        label="Description"
        validate={required()}
        multiline
        className="m-0"
        helperText={false}
      />
      {selectContact ? (
        <ReferenceInput
          source="contact_id"
          reference="contacts_summary"
          filter={contactFilter}
        >
          <AutocompleteInput
            label="Contact"
            optionText={contactOptionText}
            helperText={false}
            validate={required()}
            modal
          />
        </ReferenceInput>
      ) : null}

      {showDealLink ? (
        <ReferenceInput source="deal_id" reference="deals">
          <AutocompleteInput
            label="Project"
            optionText={dealOptionText}
            helperText={false}
            modal
          />
        </ReferenceInput>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DateInput source="due_date" helperText={false} validate={required()} />
        <SelectInput
          source="type"
          validate={required()}
          choices={taskTypes}
          optionText="label"
          optionValue="value"
          helperText={false}
        />
        <SelectInput
          source="priority"
          label="Priority"
          choices={TASK_PRIORITIES}
          optionText="label"
          optionValue="value"
          helperText={false}
          defaultValue="normal"
        />
        {showOrgAssignee ? (
          <ReferenceInput
            source="organization_member_id"
            reference="organization_members"
            filter={{ "disabled@neq": true }}
          >
            <SelectInput
              label="Assigned to"
              helperText={false}
              optionText={memberOptionText}
              validate={required()}
            />
          </ReferenceInput>
        ) : null}
      </div>

      <BooleanInput
        source="internal"
        label="Internal task (team only, not client follow-up)"
        helperText={false}
      />
    </div>
  );
};
