import { ReferenceInput } from "@/components/admin/reference-input";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { required } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import { TASK_PRIORITIES } from "@/components/atomic-crm/tasks/taskConstants";
import { TaskDescriptionMentionInput } from "@/components/atomic-crm/tasks/TaskDescriptionMentionInput";
import { CalendarReminderOffsetsInput } from "@/modules/calendar/CalendarReminderOffsetsInput";
import { CalendarTimeInput } from "@/modules/calendar/CalendarTimeInput";
import { getContactDisplayName } from "@/modules/calendar/calendarReminderOptions";
import {
  TeamMemberCollaboratorSelect,
  TeamMemberMultiSelect,
} from "@/modules/shared/TeamMemberMultiSelect";
import type { WorkCategory } from "@/modules/work/workTypes";

const dealOptionText = (choice: {
  name?: string | null;
  id?: number | string;
}) => choice.name?.trim() || `Project #${choice.id}`;

const contactOptionText = (contact: Contact) => getContactDisplayName(contact);

export const WorkCreateTaskFields = ({
  category,
  defaultDealId,
}: {
  category: WorkCategory;
  defaultDealId?: string | number | null;
}) => (
  <>
    <TaskDescriptionMentionInput
      autoFocus
      source="text"
      label="Description"
      validate={required()}
      className="m-0"
      defaultDealId={defaultDealId}
      rows={3}
    />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DateInput
        source="due_date"
        label="Date"
        helperText={false}
        validate={required()}
      />
      {category === "task" ? (
        <SelectInput
          source="priority"
          label="Priority"
          choices={TASK_PRIORITIES}
          optionText="label"
          optionValue="value"
          helperText={false}
          defaultValue="normal"
        />
      ) : (
        <span className="hidden sm:block" aria-hidden />
      )}
    </div>
    <TeamMemberMultiSelect
      source="assignee_person_ids"
      label="Assignees"
      required
    />
    <TeamMemberCollaboratorSelect />
    <WorkCreateLinkFields showContactLink />
  </>
);

export const WorkCreateEventFields = ({
  category,
}: {
  category: WorkCategory;
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
        label={category === "follow_up" ? "Due time" : "Time"}
        helperText={false}
      />
    </div>
    <TeamMemberMultiSelect
      source="assignee_member_ids"
      label="Assignees"
      required
    />
    <CalendarReminderOffsetsInput />
    <WorkCreateLinkFields showContactLink />
  </>
);

const WorkCreateLinkFields = ({
  showContactLink = true,
}: {
  showContactLink?: boolean;
}) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <ReferenceInput source="deal_id" reference="deals">
      <AutocompleteInput
        label="Project"
        optionText={dealOptionText}
        helperText={false}
        modal
        emptyText="None"
        filterToQuery={(searchText) => ({ q: searchText })}
      />
    </ReferenceInput>
    {showContactLink ? (
      <ReferenceInput source="contact_id" reference="contacts_summary">
        <AutocompleteInput
          label="Link contact / deal (optional)"
          optionText={contactOptionText}
          inputText={contactOptionText}
          helperText={false}
          modal
          emptyText="None"
          filterToQuery={(searchText) => ({ q: searchText })}
        />
      </ReferenceInput>
    ) : null}
  </div>
);
