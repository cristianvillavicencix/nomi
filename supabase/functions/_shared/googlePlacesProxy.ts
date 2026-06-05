export type GooglePlacesAutocompleteMode = "address" | "business";

export type GooglePlaceSuggestion = {
  placeId: string;
  text: string;
};

export type GooglePlaceDetails = {
  placeId: string;
  name: string;
  formattedAddress: string;
  phone: string;
  website: string;
  googleMapsUri: string;
  city: string;
  stateAbbr: string;
  zipcode: string;
  country: string;
};

export const getGooglePlacesServerApiKey = (): string =>
  Deno.env.get("GOOGLE_PLACES_API_KEY")?.trim() ?? "";

const legacyTypesForMode = (mode: GooglePlacesAutocompleteMode) =>
  mode === "business" ? "establishment" : "address";

const stripWebsiteForDisplay = (uri: string): string =>
  uri.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");

type AddressComponent = {
  types?: string[];
  longText?: string;
  shortText?: string;
  long_name?: string;
  short_name?: string;
};

const pickComponent = (
  components: AddressComponent[] | undefined,
  type: string,
  useShort = false,
) => {
  const match = components?.find((c) => c.types?.includes(type));
  if (!match) return "";
  if (useShort) {
    return match.shortText ?? match.short_name ?? "";
  }
  return match.longText ?? match.long_name ?? "";
};

export const serverPlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
): Promise<GooglePlaceSuggestion[]> => {
  const key = getGooglePlacesServerApiKey();
  if (!key || input.trim().length < 3) return [];

  const newResult = await fetchNewPlacesAutocomplete(input, mode, key);
  if (newResult !== "forbidden") {
    return newResult;
  }

  return fetchLegacyPlacesAutocomplete(input, mode, key);
};

const fetchNewPlacesAutocomplete = async (
  input: string,
  _mode: GooglePlacesAutocompleteMode,
  key: string,
): Promise<GooglePlaceSuggestion[] | "forbidden"> => {
  const body: Record<string, unknown> = {
    input: input.trim(),
    languageCode: "en",
    regionCode: "US",
  };

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify(body),
    },
  );

  if (response.status === 403) return "forbidden";
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    suggestions?: Array<{
      placePrediction?: { placeId?: string; text?: { text?: string } };
    }>;
  };

  return (
    payload.suggestions
      ?.map((item) => ({
        placeId: String(item.placePrediction?.placeId ?? ""),
        text: String(item.placePrediction?.text?.text ?? ""),
      }))
      .filter((item) => item.placeId && item.text)
      .slice(0, 8) ?? []
  );
};

const fetchLegacyPlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  key: string,
): Promise<GooglePlaceSuggestion[]> => {
  const params = new URLSearchParams({
    input: input.trim(),
    key,
    language: "en",
    components: "country:us",
    types: legacyTypesForMode(mode),
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
  );
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    status?: string;
    predictions?: Array<{ place_id?: string; description?: string }>;
  };

  if (payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
    return [];
  }

  return (
    payload.predictions
      ?.map((item) => ({
        placeId: String(item.place_id ?? ""),
        text: String(item.description ?? ""),
      }))
      .filter((item) => item.placeId && item.text)
      .slice(0, 8) ?? []
  );
};

export const serverPlaceDetails = async (
  placeId: string,
): Promise<GooglePlaceDetails | null> => {
  const key = getGooglePlacesServerApiKey();
  if (!key || !placeId.trim()) return null;

  const fromNew = await fetchNewPlaceDetails(placeId, key);
  if (fromNew === "forbidden") {
    return fetchLegacyPlaceDetails(placeId, key);
  }
  if (fromNew) return fromNew;

  return fetchLegacyPlaceDetails(placeId, key);
};

const fetchNewPlaceDetails = async (
  placeId: string,
  key: string,
): Promise<GooglePlaceDetails | null | "forbidden"> => {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,googleMapsUri,addressComponents",
      },
    },
  );

  if (response.status === 403) return "forbidden";
  if (!response.ok) return null;

  const payload = (await response.json()) as Record<string, unknown>;
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

const fetchLegacyPlaceDetails = async (
  placeId: string,
  key: string,
): Promise<GooglePlaceDetails | null> => {
  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "formatted_phone_number",
    "website",
    "address_component",
    "url",
  ].join(",");

  const params = new URLSearchParams({
    place_id: placeId,
    key,
    language: "en",
    fields,
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    status?: string;
    result?: Record<string, unknown>;
  };

  if (payload.status !== "OK" || !payload.result) return null;

  const result = payload.result;
  const components = result.address_component as AddressComponent[] | undefined;

  return {
    placeId,
    name: String(result.name ?? "").trim(),
    formattedAddress: String(result.formatted_address ?? "").trim(),
    phone: String(result.formatted_phone_number ?? "").trim(),
    website: stripWebsiteForDisplay(String(result.website ?? "")),
    googleMapsUri: String(result.url ?? "").trim(),
    city: pickComponent(components, "locality"),
    stateAbbr: pickComponent(components, "administrative_area_level_1", true),
    zipcode: pickComponent(components, "postal_code"),
    country: pickComponent(components, "country", true),
  };
};
