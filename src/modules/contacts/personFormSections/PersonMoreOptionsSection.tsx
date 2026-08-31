import { useEffect } from "react";
import { required } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { ChevronDown } from "lucide-react";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { isGooglePlacesEnabled } from "@/lib/googlePlaces";
import type { GooglePlaceDetails } from "@/lib/googlePlaces";
import { resolveStreetLine } from "@/lib/googlePlaces/normalize";
import { CONTACT_STATUS_CHOICES } from "@/modules/constants/contactStatus";
import type { PersonFormValues } from "@/modules/contacts/personFormTypes";
import type { LeadType } from "@/modules/leads/leadFormConstants";
import { LBS_CONTACT_ROLE_CHOICES } from "@/modules/leads/leadFormConstants";

const DIRECTORY_INACTIVE_CHOICE = CONTACT_STATUS_CHOICES.filter((entry) =>
  ["contact_only", "inactive"].includes(entry.value),
);

type PersonMoreOptionsSectionProps = {
  showUseCompanyContactInfo: boolean;
  showInactiveDirectoryStatus: boolean;
  leadType: LeadType;
};

export const PersonMoreOptionsSection = ({
  showUseCompanyContactInfo,
  showInactiveDirectoryStatus,
  leadType,
}: PersonMoreOptionsSectionProps) => {
  const { setValue } = useFormContext<PersonFormValues>();
  const placesEnabled = isGooglePlacesEnabled();
  const useCompanyInfo = useWatch<PersonFormValues, "use_company_contact_info">(
    { name: "use_company_contact_info" },
  );
  const companyDraftPhone = useWatch<PersonFormValues, "company_draft_phone">({
    name: "company_draft_phone",
  });
  const companyDraftAddress = useWatch<
    PersonFormValues,
    "company_draft_address"
  >({ name: "company_draft_address" });

  const canCopyFromCompany =
    showUseCompanyContactInfo && Boolean(companyDraftPhone?.trim());

  useEffect(() => {
    if (!useCompanyInfo || !canCopyFromCompany || !companyDraftPhone?.trim()) {
      return;
    }
    setValue(
      "phone_jsonb",
      [{ number: companyDraftPhone.trim(), type: "Work" }],
      { shouldDirty: true },
    );
    if (companyDraftAddress?.trim()) {
      setValue("address", companyDraftAddress.trim(), { shouldDirty: true });
    }
  }, [
    useCompanyInfo,
    canCopyFromCompany,
    companyDraftPhone,
    companyDraftAddress,
    setValue,
  ]);

  const handlePlaceDetails = (details: GooglePlaceDetails) => {
    const street = resolveStreetLine(details);
    if (street) {
      setValue("address", street, { shouldDirty: true });
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
    <details className="group rounded-md border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span>More options</span>
        <ChevronDown className="size-4 shrink-0 opacity-60 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t px-4 pt-4 pb-4">
        {canCopyFromCompany ? (
          <div className="flex items-start gap-2 rounded-md border bg-muted/20 p-3">
            <Checkbox
              id="person-use-company-contact-info"
              checked={Boolean(useCompanyInfo)}
              onCheckedChange={(checked) =>
                setValue("use_company_contact_info", Boolean(checked), {
                  shouldDirty: true,
                })
              }
            />
            <Label
              htmlFor="person-use-company-contact-info"
              className="cursor-pointer text-sm font-normal leading-snug"
            >
              Use company phone and address for the contact
            </Label>
          </div>
        ) : null}

        {placesEnabled ? (
          <GooglePlacesAutocompleteInput
            source="address"
            label="Street"
            mode="address"
            helperText={false}
            labelVariant="floating"
            onPlaceDetails={handlePlaceDetails}
          />
        ) : (
          <TextInput
            source="address"
            label="Street"
            helperText={false}
            labelVariant="floating"
          />
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            source="city"
            label="City"
            helperText={false}
            labelVariant="floating"
          />
          <TextInput
            source="zipcode"
            label="Zip code"
            helperText={false}
            labelVariant="floating"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            source="state_abbr"
            label="State"
            helperText={false}
            labelVariant="floating"
          />
          <TextInput
            source="country"
            label="Country"
            helperText={false}
            labelVariant="floating"
          />
        </div>

        {leadType === "business" ? (
          <SelectInput
            source="title"
            label="Title / role"
            choices={[...LBS_CONTACT_ROLE_CHOICES]}
            optionText="name"
            helperText={false}
            emptyText="Select role"
            labelVariant="floating"
          />
        ) : (
          <TextInput
            source="title"
            label="Title / role"
            helperText={false}
            placeholder="Owner, Office manager, Estimator…"
            labelVariant="floating"
          />
        )}

        <TextInput
          source="background"
          label="Notes"
          multiline
          helperText={false}
          labelVariant="floating"
        />

        {showInactiveDirectoryStatus ? (
          <SelectInput
            source="status"
            label="Directory status"
            helperText="Client membership is set by won deals and lead conversion."
            choices={DIRECTORY_INACTIVE_CHOICE.map((entry) => ({
              id: entry.value,
              name: entry.label,
            }))}
            validate={required()}
            labelVariant="floating"
          />
        ) : null}
      </div>
    </details>
  );
};
