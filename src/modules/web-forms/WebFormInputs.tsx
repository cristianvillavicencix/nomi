import { BooleanInput } from "@/components/admin/boolean-input";
import { TextInput } from "@/components/admin/text-input";
import { validateWebFormSlug } from "@/modules/web-forms/webFormConstants";
import { WebFormFieldsEditor } from "@/modules/web-forms/WebFormFieldsEditor";

export const WebFormInputs = ({
  slugDisabled = false,
  showFieldsEditor = true,
}: {
  slugDisabled?: boolean;
  showFieldsEditor?: boolean;
}) => (
  <>
    <TextInput
      source="name"
      validate={(value) => (value ? undefined : "Required")}
      labelVariant="floating"
    />
    <TextInput
      source="slug"
      disabled={slugDisabled}
      validate={slugDisabled ? undefined : validateWebFormSlug}
      helperText={
        slugDisabled
          ? "System form slug cannot be changed."
          : "Used in the public link: /forms/your-slug"
      }
      labelVariant="floating"
    />
    <TextInput
      source="description"
      multiline
      rows={3}
      labelVariant="floating"
    />
    <BooleanInput source="active" label="Active" />
    {showFieldsEditor ? <WebFormFieldsEditor /> : null}
  </>
);
