import { useMemo } from "react";
import { email } from "ra-core";
import type { ClipboardEventHandler, FocusEvent } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { SelectInput } from "@/components/admin/select-input";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { buildContactChannelTypeChoices } from "@/modules/contacts/contactChannelTypeChoices";
import { PersonFormSection } from "@/modules/contacts/personFormSections/PersonFormSection";

export const PersonContactSection = () => {
  const { getValues, setValue, control } = useFormContext();
  const phoneEntries = useWatch({ control, name: "phone_jsonb" }) as
    | Array<{ type?: string | null }>
    | undefined;
  const emailEntries = useWatch({ control, name: "email_jsonb" }) as
    | Array<{ type?: string | null }>
    | undefined;

  const phoneTypeChoices = useMemo(
    () => buildContactChannelTypeChoices(phoneEntries),
    [phoneEntries],
  );
  const emailTypeChoices = useMemo(
    () => buildContactChannelTypeChoices(emailEntries),
    [emailEntries],
  );

  const handleEmailChange = (emailAddress: string) => {
    const { first_name, last_name } = getValues();
    if (first_name || last_name || !emailAddress) return;
    const [first = "", last = ""] = emailAddress.split("@")[0].split(".");
    if (first) {
      setValue("first_name", first.charAt(0).toUpperCase() + first.slice(1));
    }
    if (last) {
      setValue("last_name", last.charAt(0).toUpperCase() + last.slice(1));
    }
  };

  const handleEmailPaste: ClipboardEventHandler<
    HTMLTextAreaElement | HTMLInputElement
  > = (e) => {
    handleEmailChange(e.clipboardData?.getData("text/plain") ?? "");
  };

  const handleEmailBlur = (
    e: FocusEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    handleEmailChange(e.target.value);
  };

  return (
    <PersonFormSection title="Contact">
      <ArrayInput
        source="email_jsonb"
        label="Email addresses"
        helperText={false}
        resource="contacts"
      >
        <SimpleFormIterator
          resource="contacts"
          inline
          disableReordering
          disableClear
          className="[&>ul>li]:border-b-0 [&>ul>li]:pb-0"
        >
          <EmailInput
            source="email"
            className="w-full"
            helperText={false}
            label={false}
            placeholder="Email"
            validate={email()}
            onPaste={handleEmailPaste}
            onBlur={handleEmailBlur}
          />
          <SelectInput
            source="type"
            helperText={false}
            label={false}
            optionText="id"
            choices={emailTypeChoices}
            defaultValue="Work"
            className="w-24 min-w-24"
          />
        </SimpleFormIterator>
      </ArrayInput>
      <ArrayInput
        source="phone_jsonb"
        label="Phone numbers"
        helperText={false}
        resource="contacts"
      >
        <SimpleFormIterator
          resource="contacts"
          inline
          disableReordering
          disableClear
          className="[&>ul>li]:border-b-0 [&>ul>li]:pb-0"
        >
          <PhoneInput
            source="number"
            className="w-full"
            helperText={false}
            label={false}
            placeholder="Phone number"
          />
          <SelectInput
            source="type"
            helperText={false}
            label={false}
            optionText="id"
            choices={phoneTypeChoices}
            defaultValue="Work"
            className="w-24 min-w-24"
          />
        </SimpleFormIterator>
      </ArrayInput>
    </PersonFormSection>
  );
};
