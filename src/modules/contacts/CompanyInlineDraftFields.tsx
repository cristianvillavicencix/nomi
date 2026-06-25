import { useFormContext } from "react-hook-form";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import {
  applyGoogleAddressToLeadForm,
  applyGoogleBusinessToLeadForm,
} from "@/modules/leads/applyGoogleBusinessToLeadForm";
import { LBS_COMPANY_INDUSTRY_CHOICES } from "@/modules/leads/leadFormConstants";

/** Shared inline company fields (directory picker + pipeline business lead). */
export const CompanyInlineDraftFields = () => {
  const { setValue } = useFormContext();

  return (
    <div className="space-y-3">
      <GooglePlacesAutocompleteInput
        source="company_draft_name"
        label="Company name"
        mode="business"
        helperText={false}
        placeholder="e.g. Acme Landscaping"
        onPlaceDetails={(details) =>
          applyGoogleBusinessToLeadForm(setValue, details)
        }
      />
      <TextInput
        source="company_draft_website"
        label="Website"
        helperText={false}
        placeholder="www.example.com"
      />
      <PhoneInput
        source="company_draft_phone"
        label="Company phone"
        helperText={false}
      />
      <GooglePlacesAutocompleteInput
        source="company_draft_address"
        label="Address"
        mode="address"
        helperText={false}
        onPlaceDetails={(details) =>
          applyGoogleAddressToLeadForm(setValue, details)
        }
      />
      <SelectInput
        source="company_draft_sector"
        label="Industry"
        choices={[...LBS_COMPANY_INDUSTRY_CHOICES]}
        optionText="name"
        helperText={false}
        emptyText="Select industry"
      />
    </div>
  );
};
