const US_COUNTRY_ALIASES = new Set([
  "us",
  "usa",
  "u.s.",
  "u.s.a",
  "u.s.a.",
  "united states",
  "united states of america",
]);

export const shouldShowCountryField = (country?: string | null) => {
  const trimmed = country?.trim();
  if (!trimmed) return false;
  return !US_COUNTRY_ALIASES.has(trimmed.toLowerCase());
};

export const formatStructuredAddressDisplay = ({
  address,
  city,
  stateAbbr,
  zipcode,
  country,
}: {
  address?: string | null;
  city?: string | null;
  stateAbbr?: string | null;
  zipcode?: string | null;
  country?: string | null;
}) => {
  const street = address?.trim() ?? "";
  const cityLine = [city?.trim(), stateAbbr?.trim()].filter(Boolean).join(", ");
  const zip = zipcode?.trim() ?? "";
  const countryValue = country?.trim() ?? "";

  const parts = [
    street,
    [cityLine, zip].filter(Boolean).join(" ").trim(),
    countryValue,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "—";
};

import {
  firstAddressLine,
  stripEmbeddedLocationSuffix,
} from "@/modules/clients/addressSuffixStrip";

export type CompanyAddressDisplaySource = {
  address?: string | null;
  city?: string | null;
  state_abbr?: string | null;
  zipcode?: string | null;
  country?: string | null;
};

/** When structured columns exist, strip only a trailing location suffix. */
export const streetLineForDisplay = (
  company: CompanyAddressDisplaySource,
): string => {
  const line = firstAddressLine(company.address);
  if (!line) return "";

  return (
    stripEmbeddedLocationSuffix(line, {
      city: company.city,
      stateAbbr: company.state_abbr,
      zipcode: company.zipcode,
      country: company.country,
    }) ?? line
  );
};

/** Profile/list display: structured columns first, raw address column as fallback. */
export const resolveCompanyAddressForDisplay = (
  company: CompanyAddressDisplaySource,
): string => {
  const hasStructuredColumns = Boolean(
    company.city?.trim() ||
      company.state_abbr?.trim() ||
      company.zipcode?.trim() ||
      company.country?.trim(),
  );

  if (hasStructuredColumns) {
    return formatStructuredAddressDisplay({
      address: streetLineForDisplay(company),
      city: company.city,
      stateAbbr: company.state_abbr,
      zipcode: company.zipcode,
      country: company.country,
    });
  }

  const raw = firstAddressLine(company.address);
  return raw || "—";
};
