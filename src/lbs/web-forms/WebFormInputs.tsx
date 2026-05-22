import { BooleanInput } from "@/components/admin/boolean-input";
import { TextInput } from "@/components/admin/text-input";
import { validateWebFormSlug } from "@/lbs/web-forms/webFormConstants";
import { WebFormFieldsEditor } from "@/lbs/web-forms/WebFormFieldsEditor";

export const WebFormInputs = ({
  slugDisabled = false,
  showFieldsEditor = true,
}: {
  slugDisabled?: boolean;
  showFieldsEditor?: boolean;
}) => (
  <>
    <TextInput source="name" validate={(value) => (value ? undefined : "Required")} />
    <TextInput
      source="slug"
      disabled={slugDisabled}
      validate={slugDisabled ? undefined : validateWebFormSlug}
      helperText={
        slugDisabled
          ? "System form slug cannot be changed."
          : "Used in the public link: /forms/your-slug"
      }
    />
    <TextInput source="description" multiline rows={3} />
    <BooleanInput source="active" label="Active" />
    {showFieldsEditor ? <WebFormFieldsEditor /> : null}
  </>
);
