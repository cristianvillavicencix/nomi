import { required, useRecordContext } from "ra-core";
import { useFormContext } from "react-hook-form";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { isGooglePlacesEnabled } from "@/lib/googlePlaces";
import {
  applyGoogleAddressToCompanyForm,
  applyGoogleBusinessToCompanyForm,
} from "./applyGooglePlaceToCompanyForm";
import { SelectInput } from "@/components/admin/select-input";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import ImageEditorField from "../misc/ImageEditorField";
import { isLinkedinUrl } from "../misc/isLinkedInUrl";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, OrganizationMember } from "../types";
import { getCompanyAvatarFallback } from "./CompanyAvatar";
import { sizes } from "./sizes";
import { CreateFormSection } from "@/modules/shared/createForm/CreateFormLayout";

const isUrl = (url: string) => {
  if (!url) return;
  const UrlRegex = new RegExp(
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i,
  );
  if (!UrlRegex.test(url)) {
    return "Must be a valid URL";
  }
};

export const CompanyInputs = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-4 p-1">
      <CompanyDisplayInputs />
      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <div className="flex flex-col gap-10 flex-1">
          <CompanyContactInputs />
          <CompanyContextInputs />
        </div>
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <div className="flex flex-col gap-8 flex-1">
          <CompanyAddressInputs />
          <CompanyAdditionalInformationInputs />
          <CompanyAccountManagerInput />
        </div>
      </div>
    </div>
  );
};

const CompanyDisplayInputs = () => {
  const record = useRecordContext<Company>();
  const { setValue } = useFormContext<Company>();
  const placesEnabled = isGooglePlacesEnabled();

  return (
    <div className="flex gap-4 flex-1 flex-row">
      <ImageEditorField
        source="logo"
        type="avatar"
        width={60}
        height={60}
        emptyText={getCompanyAvatarFallback(record)}
        linkPosition="bottom"
      />
      {placesEnabled ? (
        <GooglePlacesAutocompleteInput
          source="name"
          label={false}
          mode="business"
          className="w-full h-fit"
          validate={required()}
          helperText={false}
          placeholder="Company name"
          onPlaceDetails={(details) =>
            applyGoogleBusinessToCompanyForm(setValue, details)
          }
        />
      ) : (
        <TextInput
          source="name"
          label="Company name"
          className="w-full h-fit"
          validate={required()}
          helperText={false}
          placeholder="Company name"
          labelVariant="floating"
        />
      )}
    </div>
  );
};

const CompanyContactInputs = () => {
  return (
    <CreateFormSection title="Contact">
      <TextInput
        source="website"
        helperText={false}
        validate={isUrl}
        labelVariant="floating"
      />
      <TextInput
        source="linkedin_url"
        helperText={false}
        validate={isLinkedinUrl}
        labelVariant="floating"
      />
      <PhoneInput
        source="phone_number"
        helperText={false}
        labelVariant="floating"
      />
    </CreateFormSection>
  );
};

const CompanyContextInputs = () => {
  const { companySectors } = useConfigurationContext();
  return (
    <CreateFormSection title="Context">
      <SelectInput
        source="sector"
        choices={companySectors}
        optionText="label"
        optionValue="value"
        helperText={false}
        labelVariant="floating"
      />
      <SelectInput
        source="size"
        choices={sizes}
        helperText={false}
        labelVariant="floating"
      />
      <TextInput source="revenue" helperText={false} labelVariant="floating" />
      <TextInput
        source="tax_identifier"
        helperText={false}
        labelVariant="floating"
      />
    </CreateFormSection>
  );
};

const CompanyAddressInputs = () => {
  const { setValue } = useFormContext<Company>();
  const placesEnabled = isGooglePlacesEnabled();

  return (
    <CreateFormSection title="Address">
      {placesEnabled ? (
        <GooglePlacesAutocompleteInput
          source="address"
          label="Street"
          mode="address"
          multiline
          helperText={false}
          labelVariant="floating"
          onPlaceDetails={(details) =>
            applyGoogleAddressToCompanyForm(setValue, details)
          }
        />
      ) : (
        <TextInput
          source="address"
          helperText={false}
          labelVariant="floating"
        />
      )}
      <TextInput source="city" helperText={false} labelVariant="floating" />
      <TextInput source="zipcode" helperText={false} labelVariant="floating" />
      <TextInput
        source="state_abbr"
        helperText={false}
        labelVariant="floating"
      />
      <TextInput source="country" helperText={false} labelVariant="floating" />
    </CreateFormSection>
  );
};

const CompanyAdditionalInformationInputs = () => {
  return (
    <CreateFormSection title="Additional information">
      <TextInput
        source="description"
        multiline
        helperText={false}
        labelVariant="floating"
      />
      <ArrayInput source="context_links" helperText={false}>
        <SimpleFormIterator disableReordering fullWidth getItemLabel={false}>
          <TextInput
            source=""
            label={false}
            helperText={false}
            validate={isUrl}
          />
        </SimpleFormIterator>
      </ArrayInput>
    </CreateFormSection>
  );
};

const CompanyAccountManagerInput = () => {
  return (
    <CreateFormSection title="Account manager">
      <ReferenceInput
        source="organization_member_id"
        reference="organization_members"
        filter={{
          "disabled@neq": true,
        }}
      >
        <SelectInput
          label="Account manager"
          helperText={false}
          optionText={saleOptionRenderer}
          labelVariant="floating"
        />
      </ReferenceInput>
    </CreateFormSection>
  );
};

const saleOptionRenderer = (choice: OrganizationMember) =>
  `${choice.first_name} ${choice.last_name}`;
