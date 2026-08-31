import { useMemo, useState } from "react";
import { required } from "ra-core";
import { useWatch } from "react-hook-form";
import { ChevronDown } from "lucide-react";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import type { Identifier } from "ra-core";
import { ContactCompanyPickerField } from "@/modules/contacts/ContactCompanyPickerField";
import { buildContactChannelTypeChoices } from "@/modules/contacts/contactChannelTypeChoices";
import type { PersonFormValues } from "@/modules/contacts/personFormTypes";
import { ProgressiveMultiChannelInput } from "@/modules/shared/ProgressiveMultiChannelInput";

type PersonCompactPreviewProps = {
  lockCompanyId?: Identifier;
  onExpand: () => void;
};

/** Minimal fields shown before expanding a compact person form. */
export const PersonCompactPreview = ({
  lockCompanyId,
  onExpand,
}: PersonCompactPreviewProps) => {
  const emailEntries = useWatch<PersonFormValues, "email_jsonb">({
    name: "email_jsonb",
  });
  const phoneEntries = useWatch<PersonFormValues, "phone_jsonb">({
    name: "phone_jsonb",
  });
  const emailTypeChoices = useMemo(
    () => buildContactChannelTypeChoices(emailEntries),
    [emailEntries],
  );
  const phoneTypeChoices = useMemo(
    () => buildContactChannelTypeChoices(phoneEntries),
    [phoneEntries],
  );

  return (
  <div className="flex flex-col gap-4">
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
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
          validate={required()}
          helperText={false}
          labelVariant="floating"
        />
      </div>
      <ProgressiveMultiChannelInput
        source="email_jsonb"
        kind="email"
        label="Email"
        valueKey="email"
        typeChoices={emailTypeChoices}
        addLabel="+ Add email"
      />
      <ProgressiveMultiChannelInput
        source="phone_jsonb"
        kind="phone"
        label="Phone"
        valueKey="number"
        typeChoices={phoneTypeChoices}
        addLabel="+ Add phone"
      />
      {lockCompanyId != null ? null : <ContactCompanyPickerField />}
    </div>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-fit gap-1 px-0 text-muted-foreground hover:text-foreground"
      onClick={onExpand}
    >
      <ChevronDown className="size-4" />
      Show more fields
    </Button>
  </div>
  );
};

/** Watches form values needed for compact → full transition visibility. */
export const usePersonFormWatchValues = () => {
  const personKind = useWatch<PersonFormValues, "person_kind">({
    name: "person_kind",
  });
  const leadType = useWatch<PersonFormValues, "lead_type">({
    name: "lead_type",
  });
  const addPrimaryContact = useWatch<PersonFormValues, "add_primary_contact">({
    name: "add_primary_contact",
  });

  return { personKind, leadType, addPrimaryContact };
};

export const usePersonFormExpandedState = (variant: "full" | "compact") => {
  const [expanded, setExpanded] = useState(variant === "full");
  return { expanded, setExpanded };
};
