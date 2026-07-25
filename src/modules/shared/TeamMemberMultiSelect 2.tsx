import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { getMemberOptionText } from "@/components/atomic-crm/tasks/taskMemberOptions";

const requireAtLeastOne = (value?: unknown) => {
  const ids = Array.isArray(value)
    ? value.filter((item) => item != null && item !== "")
    : [];
  return ids.length > 0 ? undefined : "Required";
};

export const TeamMemberMultiSelect = ({
  source,
  label = "Assignees",
  required = false,
  placeholder = "Select team members",
  helperText = false,
}: {
  source: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  helperText?: boolean;
}) => (
  <ReferenceArrayInput
    source={source}
    reference="organization_members"
    filter={{ "disabled@neq": true }}
  >
    <AutocompleteArrayInput
      label={label}
      optionText={getMemberOptionText}
      validate={required ? requireAtLeastOne : undefined}
      helperText={helperText}
      placeholder={placeholder}
      filterToQuery={(searchText) => ({ q: searchText })}
    />
  </ReferenceArrayInput>
);

export const TeamMemberCollaboratorSelect = ({
  source = "collaborator_person_ids",
  label = "Collaborators",
}: {
  source?: string;
  label?: string;
}) => (
  <ReferenceArrayInput
    source={source}
    reference="organization_members"
    filter={{ "disabled@neq": true }}
  >
    <AutocompleteArrayInput
      label={label}
      optionText={getMemberOptionText}
      helperText={false}
      placeholder="Optional collaborators"
      filterToQuery={(searchText) => ({ q: searchText })}
    />
  </ReferenceArrayInput>
);
