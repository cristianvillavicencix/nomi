import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { isGooglePlacesEnabled } from "@/lib/googlePlaces";
import {
  inferUsTimezoneFromAddress,
  US_TIMEZONE_CHOICES,
} from "@/lib/timezone/usTimezone";
import {
  defaultCompanySectors,
  primaryBusinessSectorUnsetToken,
} from "../root/defaultConfiguration";
import ImageEditorField from "../misc/ImageEditorField";
import { isTenantBrandingEditorVisible } from "./tenantBrandingFlags";
import { applyGoogleAddressToOrgProfileForm } from "./applyGooglePlaceToOrgProfileForm";
import { SettingsSubNav } from "@/modules/settings/SettingsSubNav";
import { SettingsTabPanel } from "@/modules/settings/SettingsTabPanel";
import type { CompanySectionId } from "@/modules/settings/settingsNavigation";

const SECTOR_CHOICES = [
  { id: primaryBusinessSectorUnsetToken, name: "Select a sector" },
  ...defaultCompanySectors.map((s) => ({ id: s.value, name: s.label })),
];

/** Same rules as company forms; allows empty. */
const optionalWebsite = (value: string) => {
  if (value == null || String(value).trim() === "") return undefined;
  const UrlRegex = new RegExp(
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i,
  );
  if (!UrlRegex.test(String(value).trim())) {
    return "Enter a valid website URL (e.g. https://yoursite.com)";
  }
  return undefined;
};

type Props = {
  activeSection: CompanySectionId;
  onSectionChange: (section: CompanySectionId) => void;
};

/**
 * Company profile: business details + optional branding.
 */
export const SettingsGeneralTab = ({
  activeSection,
  onSectionChange,
}: Props) => {
  const showBranding = isTenantBrandingEditorVisible();

  if (!showBranding) {
    return <CompanyProfileFields />;
  }

  return (
    <SettingsSubNav
      value={activeSection}
      onValueChange={onSectionChange}
      items={[
        { id: "profile", label: "Business" },
        { id: "branding", label: "Branding" },
      ]}
    >
      <SettingsTabPanel value="profile">
        <CompanyProfileFields />
      </SettingsTabPanel>
      <SettingsTabPanel value="branding">
        <BrandingFields />
      </SettingsTabPanel>
    </SettingsSubNav>
  );
};

/** Fill timezone from address only when the field is still empty. */
const CompanyTimezoneAutoFill = () => {
  const { setValue, getValues } = useFormContext();
  const state = useWatch({ name: "companyState" });
  const postal = useWatch({ name: "companyPostalCode" });
  const country = useWatch({ name: "companyCountry" });

  useEffect(() => {
    const current = String(getValues("companyTimezone") ?? "").trim();
    if (current) return;
    const inferred = inferUsTimezoneFromAddress({
      stateAbbr: typeof state === "string" ? state : null,
      zipcode: typeof postal === "string" ? postal : null,
      country: typeof country === "string" ? country : null,
    });
    if (inferred) {
      setValue("companyTimezone", inferred, { shouldDirty: false });
    }
  }, [state, postal, country, getValues, setValue]);

  return null;
};

const CompanyProfileFields = () => {
  const { setValue } = useFormContext();
  const placesEnabled = isGooglePlacesEnabled();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <CompanyTimezoneAutoFill />
      <TextInput source="companyLegalName" label="Business name" labelVariant="floating" />
      <TextInput source="companyPhone" label="Phone" labelVariant="floating" />
      <TextInput source="companyEmail" label="Email" type="email" labelVariant="floating" />
      <TextInput
        source="companyWebsite"
        label="Website"
        type="url"
        placeholder="https://example.com"
        validate={optionalWebsite}
        labelVariant="floating"
      />
      <div className="sm:col-span-2 lg:col-span-3">
        {placesEnabled ? (
          <GooglePlacesAutocompleteInput
            source="companyAddressLine1"
            label="Address"
            mode="address"
            multiline
            className="w-full"
            helperText="Used for invoices and to set your workspace timezone"
            labelVariant="floating"
            onPlaceDetails={(details) =>
              applyGoogleAddressToOrgProfileForm(setValue, details)
            }
          />
        ) : (
          <TextInput
            source="companyAddressLine1"
            label="Address"
            className="w-full"
            multiline
            rows={2}
            helperText="Used for invoices and to set your workspace timezone"
            labelVariant="floating"
          />
        )}
      </div>
      <TextInput source="companyCity" label="City" labelVariant="floating" />
      <TextInput
        source="companyState"
        label="State"
        placeholder="TX"
        helperText="Two-letter US state (e.g. TX)"
        labelVariant="floating"
      />
      <TextInput
        source="companyPostalCode"
        label="ZIP / Postal code"
        placeholder="78640"
        labelVariant="floating"
      />
      <TextInput source="companyCountry" label="Country" labelVariant="floating" />
      <SelectInput
        source="companyTimezone"
        label="Workspace timezone"
        choices={US_TIMEZONE_CHOICES}
        helperText="Host timezone for meetings, booking links, and calendar invites. Auto-filled from your address; you can override."
        labelVariant="floating"
      />
      <div className="sm:col-span-2 lg:col-span-1">
        <SelectInput
          source="primaryBusinessSector"
          label="Your sector (industry)"
          choices={SECTOR_CHOICES}
          labelVariant="floating"
        />
      </div>
    </div>
  );
};

const BrandingFields = () => (
  <div className="space-y-4">
    <TextInput source="title" label="App title" labelVariant="floating" />
    <div className="flex flex-wrap gap-8">
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm text-muted-foreground">Light logo</p>
        <ImageEditorField
          source="lightModeLogo"
          width={100}
          height={100}
          linkPosition="bottom"
          backgroundImageColor="#f5f5f5"
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm text-muted-foreground">Dark logo</p>
        <ImageEditorField
          source="darkModeLogo"
          width={100}
          height={100}
          linkPosition="bottom"
          backgroundImageColor="#1a1a1a"
        />
      </div>
    </div>
  </div>
);
