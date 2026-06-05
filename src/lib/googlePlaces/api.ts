import { getGooglePlacesApiKey, isGooglePlacesEnabled } from "./config";
import {
  fetchEdgePlaceDetails,
  fetchEdgePlacesAutocomplete,
} from "./edgeProxy";
import { mapPlaceDetailsFromApi } from "./normalize";
import type {
  GooglePlaceDetails,
  GooglePlacesAutocompleteMode,
  GooglePlaceSuggestion,
} from "./types";

const LEGACY_STORAGE_KEY = "nomi_google_places_use_legacy";
const PROXY_STORAGE_KEY = "nomi_google_places_use_proxy";

const readPreferProxy = (): boolean => {
  if (typeof sessionStorage === "undefined") return false;
  if (sessionStorage.getItem(LEGACY_STORAGE_KEY) === "1") {
    sessionStorage.setItem(PROXY_STORAGE_KEY, "1");
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    return true;
  }
  return sessionStorage.getItem(PROXY_STORAGE_KEY) === "1";
};

const markPreferProxy = () => {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(PROXY_STORAGE_KEY, "1");
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  }
};

const fetchNewPlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  signal?: AbortSignal,
): Promise<{ ok: true; data: GooglePlaceSuggestion[] } | { ok: false; status: number }> => {
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

const fetchProxyPlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  signal?: AbortSignal,
): Promise<GooglePlaceSuggestion[]> => {
  try {
    return await fetchEdgePlacesAutocomplete(input, mode, signal);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[Google Places] edge proxy autocomplete failed:", error);
    }
    return [];
  }
};

export const fetchPlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  signal?: AbortSignal,
): Promise<GooglePlaceSuggestion[]> => {
  if (!isGooglePlacesEnabled() || input.trim().length < 3) {
    return [];
  }

  if (readPreferProxy()) {
    return fetchProxyPlacesAutocomplete(input, mode, signal);
  }

  const result = await fetchNewPlacesAutocomplete(input, mode, signal);
  if (result.ok) {
    return result.data;
  }

  if (result.status === 403) {
    markPreferProxy();
    if (import.meta.env.DEV) {
      console.info(
        "[Google Places] New API denied (403). Using server proxy for autocomplete.",
      );
    }
  }

  return fetchProxyPlacesAutocomplete(input, mode, signal);
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

const fetchProxyPlaceDetails = async (
  placeId: string,
  signal?: AbortSignal,
): Promise<GooglePlaceDetails | null> => {
  try {
    return await fetchEdgePlaceDetails(placeId, signal);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[Google Places] edge proxy details failed:", error);
    }
    return null;
  }
};

export const fetchGooglePlaceDetails = async (
  placeId: string,
  signal?: AbortSignal,
): Promise<GooglePlaceDetails | null> => {
  if (!isGooglePlacesEnabled() || !placeId.trim()) {
    return null;
  }

  if (readPreferProxy()) {
    return fetchProxyPlaceDetails(placeId, signal);
  }

  const result = await fetchNewPlaceDetails(placeId, signal);
  if (result === "forbidden") {
    markPreferProxy();
    return fetchProxyPlaceDetails(placeId, signal);
  }
  if (result) {
    return result;
  }

  return fetchProxyPlaceDetails(placeId, signal);
};
