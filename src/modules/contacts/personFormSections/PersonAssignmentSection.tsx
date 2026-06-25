import { required } from "ra-core";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { PersonFormSection } from "@/modules/contacts/personFormSections/PersonFormSection";

const getMemberOptionText = (member?: Partial<OrganizationMember>) => {
  if (!member) return "";
  const fullName = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(" ");
  if (member.email) return `${fullName} (${member.email})`;
  return fullName;
};

const saleOptionRenderer = (choice: OrganizationMember) =>
  `${choice.first_name} ${choice.last_name}`;

const requireAssignedMembers = (value?: unknown) => {
  const ids = Array.isArray(value)
    ? value.filter((item) => item != null && item !== "")
    : [];
  return ids.length > 0 ? undefined : "Required";
};

type PersonAssignmentSectionProps = {
  assignmentMulti: boolean;
};

export const PersonAssignmentSection = ({
  assignmentMulti,
}: PersonAssignmentSectionProps) => (
  <PersonFormSection title="Assignment">
    {assignmentMulti ? (
      <ReferenceArrayInput
        source="assigned_member_ids"
        reference="organization_members"
        filter={{ "disabled@neq": true }}
      >
        <AutocompleteArrayInput
          label="Assigned to"
          optionText={getMemberOptionText}
          validate={requireAssignedMembers}
          helperText={false}
          placeholder="Select one or more team members"
          filterToQuery={(searchText) => ({ q: searchText })}
        />
      </ReferenceArrayInput>
    ) : (
      <ReferenceInput
        reference="organization_members"
        source="organization_member_id"
        sort={{ field: "last_name", order: "ASC" }}
        filter={{ "disabled@neq": true }}
      >
        <SelectInput
          helperText={false}
          label="Assigned to"
          optionText={saleOptionRenderer}
          validate={required()}
        />
      </ReferenceInput>
    )}
  </PersonFormSection>
);
