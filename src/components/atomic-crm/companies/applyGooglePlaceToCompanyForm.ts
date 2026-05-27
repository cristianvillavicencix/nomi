import type { UseFormSetValue } from "react-hook-form";
import type { GooglePlaceDetails } from "@/lib/googlePlaces";
import type { Company } from "../types";

export const applyGoogleBusinessToCompanyForm = (
  setValue: UseFormSetValue<Company>,
  details: GooglePlaceDetails,
) => {
  if (details.name) {
    setValue("name", details.name, { shouldDirty: true });
  }
  if (details.website) {
    setValue("website", details.website, { shouldDirty: true });
  }
  if (details.phone) {
    setValue("phone_number", details.phone, { shouldDirty: true });
  }
  applyGoogleAddressToCompanyForm(setValue, details);
};

export const applyGoogleAddressToCompanyForm = (
  setValue: UseFormSetValue<Company>,
  details: GooglePlaceDetails,
) => {
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
