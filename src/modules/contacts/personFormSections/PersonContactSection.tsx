import { useMemo } from "react";
import type { ClipboardEventHandler, FocusEvent } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { buildContactChannelTypeChoices } from "@/modules/contacts/contactChannelTypeChoices";
import { PersonFormSection } from "@/modules/contacts/personFormSections/PersonFormSection";
import { ProgressiveMultiChannelInput } from "@/modules/shared/ProgressiveMultiChannelInput";

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
    e?: FocusEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    handleEmailChange(e?.target?.value ?? "");
  };

  return (
    <PersonFormSection title="Contact">
      <ProgressiveMultiChannelInput
        source="email_jsonb"
        kind="email"
        label="Email addresses"
        valueKey="email"
        typeChoices={emailTypeChoices}
        addLabel="+ Add email"
        onFirstEmailBlur={handleEmailBlur}
        onFirstEmailPaste={handleEmailPaste}
      />
      <ProgressiveMultiChannelInput
        source="phone_jsonb"
        kind="phone"
        label="Phone numbers"
        valueKey="number"
        typeChoices={phoneTypeChoices}
        addLabel="+ Add phone"
      />
    </PersonFormSection>
  );
};
