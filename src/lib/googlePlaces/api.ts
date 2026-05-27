import { getGooglePlacesApiKey, isGooglePlacesEnabled } from "./config";
import {
  fetchLegacyPlaceDetails,
  fetchLegacyPlacesAutocomplete,
} from "./legacy";
import { mapPlaceDetailsFromApi } from "./normalize";
import type {
  GooglePlaceDetails,
  GooglePlacesAutocompleteMode,
  GooglePlaceSuggestion,
} from "./types";

const LEGACY_STORAGE_KEY = "nomi_google_places_use_legacy";

/** Broader matching — strict types often return zero suggestions. */
const AUTOCOMPLETE_PRIMARY_TYPES: Record<
  GooglePlacesAutocompleteMode,
  string[] | undefined
> = {
  business: undefined,
  address: undefined,
};

const readPreferLegacy = (): boolean => {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(LEGACY_STORAGE_KEY) === "1";
};

const markPreferLegacy = () => {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(LEGACY_STORAGE_KEY, "1");
  }
};

const fetchNewPlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  signal?: AbortSignal,
): Promise<{ ok: true; data: GooglePlaceSuggestion[] } | { ok: false; status: number }> => {
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
        "[Google Places] autocomplete (New API) failed:",
        response.status,
        detail,
      );
    }
    return { ok: false, status: response.status };
  }

  const payload = (await response.json()) as {
    suggestions?: Array<{
      placePrediction?: { placeId?: string; text?: { text?: string } };
    }>;
  };

  const data =
    payload.suggestions
      ?.map((item) => ({
        placeId: String(item.placePrediction?.placeId ?? ""),
        text: String(item.placePrediction?.text?.text ?? ""),
      }))
      .filter((item) => item.placeId && item.text)
      .slice(0, 8) ?? [];

  return { ok: true, data };
};

export const fetchPlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  signal?: AbortSignal,
): Promise<GooglePlaceSuggestion[]> => {
  if (!isGooglePlacesEnabled() || input.trim().length < 3) {
    return [];
  }

  if (!readPreferLegacy()) {
    const result = await fetchNewPlacesAutocomplete(input, mode, signal);
    if (result.ok) {
      return result.data;
    }
    if (result.status === 403) {
      markPreferLegacy();
      if (import.meta.env.DEV) {
        console.info(
          "[Google Places] New API denied (403). Falling back to legacy Places API. Enable “Places API (New)” in Google Cloud to use the new endpoint.",
        );
      }
    } else {
      return [];
    }
  }

  return fetchLegacyPlacesAutocomplete(input, mode, signal);
};

const fetchNewPlaceDetails = async (
  placeId: string,
  signal?: AbortSignal,
): Promise<GooglePlaceDetails | null | "forbidden"> => {
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

  if (response.status === 403) {
    return "forbidden";
  }

  if (!response.ok) {
    if (import.meta.env.DEV) {
      const detail = await response.text().catch(() => "");
      console.warn("[Google Places] details (New API) failed:", response.status, detail);
    }
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return mapPlaceDetailsFromApi(placeId, payload);
};

export const fetchGooglePlaceDetails = async (
  placeId: string,
  signal?: AbortSignal,
): Promise<GooglePlaceDetails | null> => {
  if (!isGooglePlacesEnabled() || !placeId.trim()) {
    return null;
  }

  if (!readPreferLegacy()) {
    const result = await fetchNewPlaceDetails(placeId, signal);
    if (result === "forbidden") {
      markPreferLegacy();
      return fetchLegacyPlaceDetails(placeId, signal);
    }
    if (result) {
      return result;
    }
  }

  return fetchLegacyPlaceDetails(placeId, signal);
};
