import { email, required } from "ra-core";
import type { ClipboardEventHandler, FocusEvent } from "react";
import { useFormContext } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { TextInput } from "@/components/admin/text-input";
import { isGooglePlacesEnabled } from "@/lib/googlePlaces";
import { SelectInput } from "@/components/admin/select-input";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";

import { AutocompleteCompanyInput } from "../companies/AutocompleteCompanyInput.tsx";
import { isLinkedinUrl } from "../misc/isLinkedInUrl";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { isLbsMode } from "@/lbs/productMode";
import { InterestedServiceInput } from "@/lbs/leads/InterestedServiceInput";
import { LBS_LEAD_SOURCE_CHOICES } from "@/lbs/leads/leadFormConstants";
import { LeadReferrerInputs } from "@/lbs/leads/LeadReferrerInputs";
import type { OrganizationMember } from "../types";

export const ContactInputs = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-6 p-1">
      <ContactBasicsSection />
      <Separator />
      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <div className="flex flex-col gap-6 flex-1">
          <ContactPersonalInformationInputs />
        </div>
        {isMobile ? null : (
          <Separator orientation="vertical" className="flex-shrink-0" />
        )}
        <div className="flex flex-col gap-6 flex-1">
          <ContactManagementInputs />
        </div>
      </div>
    </div>
  );
};

const ContactBasicsSection = () => {
  const lbsMode = isLbsMode();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Contact</h6>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          source="first_name"
          validate={required()}
          helperText={false}
        />
        <TextInput
          source="last_name"
          validate={required()}
          helperText={false}
        />
      </div>
      <div className={lbsMode ? "" : "grid gap-4 md:grid-cols-2"}>
        {lbsMode ? null : <TextInput source="title" helperText={false} />}
        <ReferenceInput source="company_id" reference="companies" perPage={10}>
          <AutocompleteCompanyInput />
        </ReferenceInput>
      </div>
    </div>
  );
};

const ContactPersonalInformationInputs = () => {
  const { getValues, setValue } = useFormContext();

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
      <h6 className="text-lg font-semibold">Contact Info</h6>
      <ArrayInput
        source="email_jsonb"
        label="Email addresses"
        helperText={false}
      >
        <SimpleFormIterator
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
            choices={personalInfoTypes}
            defaultValue="Work"
            className="w-24 min-w-24"
          />
        </SimpleFormIterator>
      </ArrayInput>
      <ArrayInput source="phone_jsonb" label="Phone numbers" helperText={false}>
        <SimpleFormIterator
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
            choices={personalInfoTypes}
            defaultValue="Work"
            className="w-24 min-w-24"
          />
        </SimpleFormIterator>
      </ArrayInput>
      {isLbsMode() && isGooglePlacesEnabled() ? (
        <GooglePlacesAutocompleteInput
          source="address"
          label="Address"
          mode="address"
          multiline
          helperText={false}
        />
      ) : (
        <TextInput source="address" helperText={false} />
      )}
      {isLbsMode() ? null : (
        <TextInput
          source="linkedin_url"
          label="Linkedin URL"
          helperText={false}
          validate={isLinkedinUrl}
        />
      )}
    </div>
  );
};

const personalInfoTypes = [{ id: "Work" }, { id: "Home" }, { id: "Other" }];

const ContactManagementInputs = () => {
  const { noteStatuses } = useConfigurationContext();

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Management</h6>
      <SelectInput
        source="status"
        label="Status"
        helperText={false}
        choices={noteStatuses.map((status) => ({
          id: status.value,
          name: status.label,
        }))}
        validate={required()}
      />
      {isLbsMode() ? (
        <>
          <SelectInput
            source="lead_source"
            label="Lead source"
            choices={LBS_LEAD_SOURCE_CHOICES.map((entry) => ({
              id: entry.id,
              name: entry.name,
            }))}
            helperText={false}
          />
          <LeadReferrerInputs />
          <InterestedServiceInput />
        </>
      ) : null}
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
          label="Assigned To"
          optionText={saleOptionRenderer}
          validate={required()}
        />
      </ReferenceInput>
      <TextInput
        source="background"
        label="Background info (bio, how you met, etc)"
        multiline
        helperText={false}
      />
    </div>
  );
};

const saleOptionRenderer = (choice: OrganizationMember) =>
  `${choice.first_name} ${choice.last_name}`;
