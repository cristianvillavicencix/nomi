import { required } from "ra-core";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { SelectInput } from "@/components/admin/select-input";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  LBS_INTERESTED_SERVICE_CHOICES,
  LBS_LEAD_SOURCE_CHOICES,
} from "./leadFormConstants";
import { LeadReferrerInputs } from "./LeadReferrerInputs";

const getMemberOptionText = (member?: Partial<OrganizationMember>) => {
  if (!member) return "";
  const fullName = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(" ");
  if (member.email) return `${fullName} (${member.email})`;
  return fullName;
};

const requireAssignedMembers = (value?: unknown) => {
  const ids = Array.isArray(value)
    ? value.filter((item) => item != null && item !== "")
    : [];
  return ids.length > 0 ? undefined : "Required";
};

export const LeadInfoSection = () => {
  const { noteStatuses } = useConfigurationContext();

  return (
    <div className="space-y-3">
      <SelectInput
        source="lead_source"
        label="Lead source"
        choices={LBS_LEAD_SOURCE_CHOICES.map((entry) => ({
          id: entry.id,
          name: entry.name,
        }))}
        validate={required()}
        helperText={false}
      />
      <LeadReferrerInputs />

      <AutocompleteArrayInput
        source="interested_services"
        label="Service interested in"
        choices={LBS_INTERESTED_SERVICE_CHOICES.map((entry) => ({
          id: entry.id,
          name: entry.name,
        }))}
        validate={required()}
        helperText={false}
        placeholder="Select one or more services"
      />

      <SelectInput
        source="status"
        label="Status"
        choices={noteStatuses.map((status) => ({
          id: status.value,
          name: status.label,
        }))}
        validate={required()}
        helperText={false}
      />

      <ReferenceArrayInput
        source="assigned_member_ids"
        reference="organization_members"
        filter={{ "disabled@neq": true }}
      >
        <AutocompleteArrayInput
          label="Asignado a"
          optionText={getMemberOptionText}
          validate={requireAssignedMembers}
          helperText={false}
          placeholder="Selecciona uno o más miembros del equipo"
          filterToQuery={(searchText) => ({ q: searchText })}
        />
      </ReferenceArrayInput>
    </div>
  );
};
