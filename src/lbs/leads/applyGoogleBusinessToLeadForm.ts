import type { UseFormSetValue } from "react-hook-form";
import type { GooglePlaceDetails } from "@/lib/googlePlaces";
import type { NewLeadFormValues } from "./newLeadFormTypes";

export const applyGoogleBusinessToLeadForm = (
  setValue: UseFormSetValue<NewLeadFormValues>,
  details: GooglePlaceDetails,
) => {
  if (details.name) {
    setValue("company_draft_name", details.name, { shouldDirty: true });
  }
  if (details.website) {
    setValue("company_draft_website", details.website, { shouldDirty: true });
  }
  if (details.phone) {
    setValue("company_draft_phone", details.phone, { shouldDirty: true });
  }
  if (details.formattedAddress) {
    setValue("company_draft_address", details.formattedAddress, {
      shouldDirty: true,
    });
  }
};

export const applyGoogleAddressToLeadForm = (
  setValue: UseFormSetValue<NewLeadFormValues>,
  details: GooglePlaceDetails,
) => {
  if (details.formattedAddress) {
    setValue("company_draft_address", details.formattedAddress, {
      shouldDirty: true,
    });
  }
  if (details.phone) {
    setValue("company_draft_phone", details.phone, { shouldDirty: true });
  }
  if (details.website) {
    setValue("company_draft_website", details.website, { shouldDirty: true });
  }
};

export const applyGoogleAddressToContactLeadForm = (
  setValue: UseFormSetValue<NewLeadFormValues>,
  details: GooglePlaceDetails,
) => {
  if (details.formattedAddress) {
    setValue("address", details.formattedAddress, { shouldDirty: true });
  }
};
