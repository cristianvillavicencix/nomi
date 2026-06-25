import { useState } from "react";
import { required } from "ra-core";
import { useWatch } from "react-hook-form";
import { ChevronDown } from "lucide-react";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import type { Identifier } from "ra-core";
import { ContactCompanyPickerField } from "@/modules/contacts/ContactCompanyPickerField";
import type { PersonFormValues } from "@/modules/contacts/personFormTypes";

type PersonCompactPreviewProps = {
  lockCompanyId?: Identifier;
  onExpand: () => void;
};

/** Minimal fields shown before expanding a compact person form. */
export const PersonCompactPreview = ({
  lockCompanyId,
  onExpand,
}: PersonCompactPreviewProps) => (
  <div className="flex flex-col gap-4">
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          source="first_name"
          label="First name"
          validate={required()}
          helperText={false}
        />
        <TextInput
          source="last_name"
          label="Last name"
          validate={required()}
          helperText={false}
        />
      </div>
      <EmailInput
        source="email_jsonb.0.email"
        label="Email"
        helperText={false}
      />
      <PhoneInput
        source="phone_jsonb.0.number"
        label="Phone"
        helperText={false}
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
