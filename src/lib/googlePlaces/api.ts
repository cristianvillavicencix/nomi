import { getGooglePlacesApiKey, isGooglePlacesEnabled } from "./config";
import { mapPlaceDetailsFromApi } from "./normalize";
import type {
  GooglePlaceDetails,
  GooglePlacesAutocompleteMode,
  GooglePlaceSuggestion,
} from "./types";

/** Broader matching — strict types often return zero suggestions. */
const AUTOCOMPLETE_PRIMARY_TYPES: Record<
  GooglePlacesAutocompleteMode,
  string[] | undefined
> = {
  business: undefined,
  address: undefined,
};

export const fetchPlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  signal?: AbortSignal,
): Promise<GooglePlaceSuggestion[]> => {
  if (!isGooglePlacesEnabled() || input.trim().length < 3) {
    return [];
  }

  const includedPrimaryTypes = AUTOCOMPLETE_PRIMARY_TYPES[mode];
  const body: Record<string, unknown> = {
    input: input.trim(),
    languageCode: "es",
    regionCode: "US",
  };
  if (includedPrimaryTypes?.length) {
    body.includedPrimaryTypes = includedPrimaryTypes;
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": getGooglePlacesApiKey(),
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify(body),
      signal,
    },
  );

  if (!response.ok) {
    if (import.meta.env.DEV) {
      const detail = await response.text().catch(() => "");
      console.warn(
        "[Google Places] autocomplete failed:",
        response.status,
        detail,
      );
    }
    return [];
  }

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

export const fetchGooglePlaceDetails = async (
  placeId: string,
  signal?: AbortSignal,
): Promise<GooglePlaceDetails | null> => {
  if (!isGooglePlacesEnabled() || !placeId.trim()) {
    return null;
  }

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": getGooglePlacesApiKey(),
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,googleMapsUri,addressComponents",
      },
      signal,
    },
  );

  if (!response.ok) {
    if (import.meta.env.DEV) {
      const detail = await response.text().catch(() => "");
      console.warn("[Google Places] details failed:", response.status, detail);
    }
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return mapPlaceDetailsFromApi(placeId, payload);
};
