import type { UseFormSetValue } from "react-hook-form";
import type { GooglePlaceDetails } from "@/lib/googlePlaces";
import { resolveStreetLine } from "@/lib/googlePlaces/normalize";
import { inferUsTimezoneFromAddress } from "@/lib/timezone/usTimezone";

type OrgProfileAddressFields = {
  companyAddressLine1?: string;
  companyCity?: string;
  companyState?: string;
  companyPostalCode?: string;
  companyCountry?: string;
  companyTimezone?: string;
};

export const applyGoogleAddressToOrgProfileForm = (
  setValue: UseFormSetValue<OrgProfileAddressFields>,
  details: GooglePlaceDetails,
) => {
  const street = resolveStreetLine(details);
  if (street) {
    setValue("companyAddressLine1", street, { shouldDirty: true });
  }
  if (details.city) {
    setValue("companyCity", details.city, { shouldDirty: true });
  }
  if (details.stateAbbr) {
    setValue("companyState", details.stateAbbr, { shouldDirty: true });
  }
  if (details.zipcode) {
    setValue("companyPostalCode", details.zipcode, { shouldDirty: true });
  }
  if (details.country) {
    setValue("companyCountry", details.country, { shouldDirty: true });
  }

  const inferred = inferUsTimezoneFromAddress({
    stateAbbr: details.stateAbbr,
    zipcode: details.zipcode,
    country: details.country,
  });
  if (inferred) {
    setValue("companyTimezone", inferred, { shouldDirty: true });
  }
};
