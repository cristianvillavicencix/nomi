import { useMemo } from "react";
import { email, required } from "ra-core";
import type { ClipboardEventHandler, FocusEvent } from "react";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { TextInput } from "@/components/admin/text-input";
import { isGooglePlacesEnabled } from "@/lib/googlePlaces";
import type { GooglePlaceDetails } from "@/lib/googlePlaces";
import { SelectInput } from "@/components/admin/select-input";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { CONTACT_STATUS_CHOICES } from "@/modules/constants/contactStatus";
import { ContactCompanyPickerField } from "@/modules/contacts/ContactCompanyPickerField";
import { buildContactChannelTypeChoices } from "@/modules/contacts/contactChannelTypeChoices";
import type { Identifier } from "ra-core";
import type { OrganizationMember } from "@/components/atomic-crm/types";

export type LbsContactFormFieldsProps = {
  /** Compact create: name, email, phone, company only until expanded. */
  variant?: "full" | "compact";
  /** When set, company field is hidden and not editable. */
  lockCompanyId?: Identifier;
};

export const LbsContactFormFields = ({
  variant = "full",
  lockCompanyId,
}: LbsContactFormFieldsProps) => {
  const [expanded, setExpanded] = useState(variant === "full");

  if (variant === "compact" && !expanded) {
    return (
      <div className="flex flex-col gap-4">
        <CompactContactFields lockCompanyId={lockCompanyId} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit gap-1 px-0 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(true)}
        >
          <ChevronDown className="size-4" />
          Show more fields
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-1">
      <ContactNameSection />
      <ContactAddressInputs />
      <ContactRoleSection />
      <ContactInfoInputs />
      {lockCompanyId != null ? null : <ContactCompanySection />}
      <ContactManagementInputs />
    </div>
  );
};

const CompactContactFields = ({
  lockCompanyId,
}: {
  lockCompanyId?: Identifier;
}) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput
        source="_compact_first_name"
        label="First name"
        validate={required()}
        helperText={false}
      />
      <TextInput
        source="_compact_last_name"
        label="Last name"
        validate={required()}
        helperText={false}
      />
    </div>
    <EmailInput source="_compact_email" label="Email" helperText={false} />
    <PhoneInput source="_compact_phone" label="Phone" helperText={false} />
    {lockCompanyId != null ? null : <ContactCompanyPickerField />}
  </div>
);

const ContactNameSection = () => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Name</h6>
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput
        source="first_name"
        validate={required()}
        helperText={false}
      />
      <TextInput source="last_name" validate={required()} helperText={false} />
    </div>
  </div>
);

const ContactRoleSection = () => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Role</h6>
    <TextInput
      source="title"
      label="Title / role"
      helperText={false}
      placeholder="Owner, Office manager, Estimator…"
    />
  </div>
);

const ContactCompanySection = () => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Company</h6>
    <ContactCompanyPickerField />
  </div>
);

const ContactInfoInputs = () => {
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
    const emailAddress = e.clipboardData?.getData("text/plain");
    handleEmailChange(emailAddress);
  };

  const handleEmailBlur = (
    e: FocusEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    handleEmailChange(e.target.value);
  };

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Contact info</h6>
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
    </div>
  );
};

const ContactAddressInputs = () => {
  const { setValue } = useFormContext();
  const placesEnabled = isGooglePlacesEnabled();

  const handlePlaceDetails = (details: GooglePlaceDetails) => {
    if (details.formattedAddress) {
      setValue("address", details.formattedAddress, { shouldDirty: true });
    }
    if (details.city) {
      setValue("city", details.city, { shouldDirty: true });
    }
    if (details.stateAbbr) {
      setValue("state_abbr", details.stateAbbr, { shouldDirty: true });
    }
    if (details.zipcode) {
      setValue("zipcode", details.zipcode, { shouldDirty: true });
    }
    if (details.country) {
      setValue("country", details.country, { shouldDirty: true });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Address</h6>
      {placesEnabled ? (
        <GooglePlacesAutocompleteInput
          source="address"
          label="Street"
          mode="address"
          multiline
          helperText={false}
          onPlaceDetails={handlePlaceDetails}
        />
      ) : (
        <TextInput source="address" label="Street" helperText={false} />
      )}
      <TextInput source="city" helperText={false} />
      <TextInput source="zipcode" helperText={false} />
      <TextInput source="state_abbr" label="State" helperText={false} />
      <TextInput source="country" helperText={false} />
    </div>
  );
};

const ContactManagementInputs = () => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Management</h6>
    <SelectInput
      source="status"
      label="Status"
      helperText={false}
      choices={CONTACT_STATUS_CHOICES.map((entry) => ({
        id: entry.value,
        name: entry.label,
      }))}
      validate={required()}
    />
    <ReferenceInput
      reference="organization_members"
      source="organization_member_id"
      sort={{ field: "last_name", order: "ASC" }}
      filter={{
        "disabled@neq": true,
      }}
    >
      <SelectInput
        helperText={false}
        label="Assigned to"
        optionText={saleOptionRenderer}
        validate={required()}
      />
    </ReferenceInput>
    <TextInput
      source="background"
      label="Background"
      multiline
      helperText={false}
    />
  </div>
);

const saleOptionRenderer = (choice: OrganizationMember) =>
  `${choice.first_name} ${choice.last_name}`;

/** Combine the compact first/last name inputs into a single display name. */
export const compactContactFullName = (values: Record<string, unknown>) =>
  [
    String(values._compact_first_name ?? "").trim(),
    String(values._compact_last_name ?? "").trim(),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

/** True when the compact form has at least a first name entered. */
export const hasCompactContactName = (values: Record<string, unknown>) =>
  String(values._compact_first_name ?? "").trim().length > 0;

/** Map compact dialog fields to a Contact create/update payload fragment. */
export const compactContactFieldsToPayload = (values: Record<string, unknown>) => {
  const firstName = String(values._compact_first_name ?? "").trim();
  const lastName = String(values._compact_last_name ?? "").trim() || firstName;
  const emailValue = String(values._compact_email ?? "").trim();
  const phoneValue = String(values._compact_phone ?? "").trim();

  return {
    first_name: firstName,
    last_name: lastName,
    email_jsonb: emailValue
      ? [{ email: emailValue, type: "Work" as const }]
      : [],
    phone_jsonb: phoneValue
      ? [{ number: phoneValue, type: "Work" as const }]
      : [],
  };
};
