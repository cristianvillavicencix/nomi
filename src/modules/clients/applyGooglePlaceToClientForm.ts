import type { UseFormSetValue } from "react-hook-form";
import type { GooglePlaceDetails } from "@/lib/googlePlaces";
import { resolveStreetLine } from "@/lib/googlePlaces/normalize";
import type { ClientCreateFormValues } from "@/modules/clients/ClientCreateForm";

export const applyGoogleBusinessToClientForm = (
  setValue: UseFormSetValue<ClientCreateFormValues>,
  details: GooglePlaceDetails,
) => {
  if (details.name) {
    setValue("company_name", details.name, { shouldDirty: true });
  }
  if (details.website) {
    setValue("company_website", details.website, { shouldDirty: true });
  }
  if (details.phone) {
    setValue(
      "company_phones",
      [{ value: details.phone, type: "Work", isPrimary: true }],
      { shouldDirty: true },
    );
  }
  applyGoogleAddressToClientForm(setValue, details, "company");
};

export const applyGoogleAddressToClientForm = (
  setValue: UseFormSetValue<ClientCreateFormValues>,
  details: GooglePlaceDetails,
  prefix: "company" | "billing" = "company",
) => {
  const street = resolveStreetLine(details);
  if (street) {
    setValue(`${prefix}_address`, street, { shouldDirty: true });
  }
  if (details.city) {
    setValue(`${prefix}_city`, details.city, { shouldDirty: true });
  }
  if (details.stateAbbr) {
    setValue(`${prefix}_state_abbr`, details.stateAbbr, { shouldDirty: true });
  }
  if (details.zipcode) {
    setValue(`${prefix}_zipcode`, details.zipcode, { shouldDirty: true });
  }
  if (details.country) {
    setValue(`${prefix}_country`, details.country, { shouldDirty: true });
  }
};
