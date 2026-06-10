import type { UseFormSetValue } from "react-hook-form";
import type { GooglePlaceDetails } from "@/lib/googlePlaces";
import type { ClientCreateFormValues } from "@/lbs/clients/ClientCreateForm";
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
    setValue("company_phone", details.phone, { shouldDirty: true });
  }
  applyGoogleAddressToClientForm(setValue, details, "company");
};

export const applyGoogleAddressToClientForm = (
  setValue: UseFormSetValue<ClientCreateFormValues>,
  details: GooglePlaceDetails,
  prefix: "company" | "billing" = "company",
) => {
  if (details.formattedAddress) {
    setValue(`${prefix}_address`, details.formattedAddress, {
      shouldDirty: true,
    });
  }
};
