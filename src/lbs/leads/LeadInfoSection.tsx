import { required } from "ra-core";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  LBS_INTERESTED_SERVICE_CHOICES,
  LBS_LEAD_SOURCE_CHOICES,
} from "./leadFormConstants";
import { LeadReferrerInputs } from "./LeadReferrerInputs";

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

      <ReferenceInput
        reference="organization_members"
        source="organization_member_id"
        sort={{ field: "last_name", order: "ASC" }}
        filter={{ "disabled@neq": true }}
      >
        <SelectInput
          label="Assigned to"
          optionText={(choice: OrganizationMember) =>
            `${choice.first_name ?? ""} ${choice.last_name ?? ""}`.trim()
          }
          validate={required()}
          helperText={false}
        />
      </ReferenceInput>
    </div>
  );
};
