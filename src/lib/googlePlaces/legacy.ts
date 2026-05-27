import { getGooglePlacesApiKey } from "./config";
import { mapPlaceDetailsFromLegacyApi } from "./normalize";
import type {
  GooglePlaceDetails,
  GooglePlacesAutocompleteMode,
  GooglePlaceSuggestion,
} from "./types";

const LEGACY_BASE = "https://maps.googleapis.com/maps/api/place";

const legacyTypesForMode = (mode: GooglePlacesAutocompleteMode) => {
  if (mode === "business") return "establishment";
  return "address";
};

export const fetchLegacyPlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  signal?: AbortSignal,
): Promise<GooglePlaceSuggestion[]> => {
  const key = getGooglePlacesApiKey();
  const params = new URLSearchParams({
    input: input.trim(),
    key,
    language: "es",
    components: "country:us",
    types: legacyTypesForMode(mode),
  });

  const response = await fetch(
    `${LEGACY_BASE}/autocomplete/json?${params.toString()}`,
    { signal },
  );
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    status?: string;
    predictions?: Array<{ place_id?: string; description?: string }>;
    error_message?: string;
  };

  if (payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
    if (import.meta.env.DEV && payload.error_message) {
      console.warn("[Google Places legacy] autocomplete:", payload.status, payload.error_message);
    }
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

export const fetchLegacyPlaceDetails = async (
  placeId: string,
  signal?: AbortSignal,
): Promise<GooglePlaceDetails | null> => {
  const key = getGooglePlacesApiKey();
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
    language: "es",
    fields,
  });

  const response = await fetch(
    `${LEGACY_BASE}/details/json?${params.toString()}`,
    { signal },
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    status?: string;
    result?: Record<string, unknown>;
    error_message?: string;
  };

  if (payload.status !== "OK" || !payload.result) {
    if (import.meta.env.DEV && payload.error_message) {
      console.warn("[Google Places legacy] details:", payload.status, payload.error_message);
    }
    return null;
  }

  return mapPlaceDetailsFromLegacyApi(placeId, payload.result);
};
