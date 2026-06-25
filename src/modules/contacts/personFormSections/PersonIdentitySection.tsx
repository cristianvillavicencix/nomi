import { required } from "ra-core";
import { TextInput } from "@/components/admin/text-input";
import { PersonFormSection } from "@/modules/contacts/personFormSections/PersonFormSection";

export const PersonIdentitySection = () => (
  <PersonFormSection title="Identity">
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput
        source="first_name"
        label="First name"
        validate={required()}
        helperText={false}
      />
      <TextInput source="last_name" label="Last name" helperText={false} />
    </div>
  </PersonFormSection>
);
