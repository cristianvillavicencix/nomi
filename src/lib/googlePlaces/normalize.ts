import type { GooglePlaceDetails } from "./types";

export const stripWebsiteForDisplay = (uri: string): string =>
  uri.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");

export const normalizeWebsiteForStorage = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
};

type AddressComponent = {
  types?: string[];
  longText?: string;
  shortText?: string;
};

const pickComponent = (
  components: AddressComponent[] | undefined,
  type: string,
  useShort = false,
) => {
  const match = components?.find((c) => c.types?.includes(type));
  if (!match) return "";
  return (useShort ? match.shortText : match.longText) ?? "";
};

type LegacyAddressComponent = {
  types?: string[];
  long_name?: string;
  short_name?: string;
};

const pickLegacyComponent = (
  components: LegacyAddressComponent[] | undefined,
  type: string,
  useShort = false,
) => {
  const match = components?.find((c) => c.types?.includes(type));
  if (!match) return "";
  return (useShort ? match.short_name : match.long_name) ?? "";
};

/** Maps legacy Place Details JSON (`maps.googleapis.com/maps/api/place/details`). */
export const mapPlaceDetailsFromLegacyApi = (
  placeId: string,
  payload: Record<string, unknown>,
): GooglePlaceDetails => {
  const components = payload.address_components as
    | LegacyAddressComponent[]
    | undefined;

  return {
    placeId,
    name: String(payload.name ?? "").trim(),
    formattedAddress: String(payload.formatted_address ?? "").trim(),
    phone: String(payload.formatted_phone_number ?? "").trim(),
    website: stripWebsiteForDisplay(String(payload.website ?? "")),
    googleMapsUri: String(payload.url ?? "").trim(),
    city: pickLegacyComponent(components, "locality"),
    stateAbbr: pickLegacyComponent(components, "administrative_area_level_1", true),
    zipcode: pickLegacyComponent(components, "postal_code"),
    country: pickLegacyComponent(components, "country", true),
  };
};

export const mapPlaceDetailsFromApi = (
  placeId: string,
  payload: Record<string, unknown>,
): GooglePlaceDetails => {
  const displayName = payload.displayName as { text?: string } | undefined;
  const components = payload.addressComponents as AddressComponent[] | undefined;

  return {
    placeId,
    name: String(displayName?.text ?? "").trim(),
    formattedAddress: String(payload.formattedAddress ?? "").trim(),
    phone: String(
      payload.nationalPhoneNumber ?? payload.internationalPhoneNumber ?? "",
    ).trim(),
    website: stripWebsiteForDisplay(String(payload.websiteUri ?? "")),
    googleMapsUri: String(payload.googleMapsUri ?? "").trim(),
    city: pickComponent(components, "locality"),
    stateAbbr: pickComponent(components, "administrative_area_level_1", true),
    zipcode: pickComponent(components, "postal_code"),
    country: pickComponent(components, "country", true),
  };
};
