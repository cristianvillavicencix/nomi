export type LocationSuffixParts = {
  city?: string | null;
  stateAbbr?: string | null;
  zipcode?: string | null;
  country?: string | null;
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const firstAddressLine = (address?: string | null) =>
  address?.trim().split("\n")[0]?.trim() ?? "";

/**
 * Remove ONLY a trailing location suffix anchored at end of line:
 * `, {city}, {state} {zip}...` — never strips city name as an inner substring.
 */
export const stripEmbeddedLocationSuffix = (
  address: string | null | undefined,
  parts: LocationSuffixParts,
): string | null => {
  const line = firstAddressLine(address);
  const city = parts.city?.trim();
  if (!line || !city) return null;

  const cityEsc = escapeRegExp(city);
  const stateEsc = parts.stateAbbr?.trim()
    ? escapeRegExp(parts.stateAbbr.trim())
    : null;
  const zipEsc = parts.zipcode?.trim()
    ? escapeRegExp(parts.zipcode.trim())
    : null;
  const countryEsc = parts.country?.trim()
    ? escapeRegExp(parts.country.trim())
    : null;

  const suffixPatterns: RegExp[] = [];

  if (stateEsc && zipEsc && countryEsc) {
    suffixPatterns.push(
      new RegExp(
        `,\\s*${cityEsc}\\s*,\\s*${stateEsc}\\s*,\\s*${zipEsc}\\s*,\\s*${countryEsc}\\s*$`,
        "i",
      ),
    );
  }
  if (stateEsc && zipEsc) {
    suffixPatterns.push(
      new RegExp(
        `,\\s*${cityEsc}\\s*,\\s*${stateEsc}\\s*,\\s*${zipEsc}\\s*$`,
        "i",
      ),
    );
    suffixPatterns.push(
      new RegExp(`,\\s*${cityEsc}\\s*,\\s*${stateEsc}\\s+${zipEsc}\\s*$`, "i"),
    );
  }
  if (stateEsc) {
    suffixPatterns.push(
      new RegExp(`,\\s*${cityEsc}\\s*,\\s*${stateEsc}\\s*$`, "i"),
    );
  }

  for (const pattern of suffixPatterns) {
    const match = line.match(pattern);
    if (match?.index != null && match.index > 0) {
      const street = line.slice(0, match.index).trim();
      if (street && street !== line) return street;
    }
  }

  return null;
};

export const countCityOccurrences = (
  address: string | null | undefined,
  city: string | null | undefined,
) => {
  const line = firstAddressLine(address);
  const needle = city?.trim();
  if (!line || !needle) return 0;

  const re = new RegExp(escapeRegExp(needle), "gi");
  return [...line.matchAll(re)].length;
};
