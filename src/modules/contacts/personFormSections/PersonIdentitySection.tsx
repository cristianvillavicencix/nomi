import { required } from "ra-core";
import { TextInput } from "@/components/admin/text-input";
import { PersonFormSection } from "@/modules/contacts/personFormSections/PersonFormSection";
import { CreateFormFieldRow } from "@/modules/shared/createForm/CreateFormLayout";

export const PersonIdentitySection = () => (
  <PersonFormSection title="Identity">
    <CreateFormFieldRow columns={2}>
      <TextInput
        source="first_name"
        label="First name"
        validate={required()}
        helperText={false}
        labelVariant="floating"
      />
      <TextInput
        source="last_name"
        label="Last name"
        helperText={false}
        labelVariant="floating"
      />
    </CreateFormFieldRow>
  </PersonFormSection>
);
