import { getGooglePlacesApiKey, isGooglePlacesEnabled } from "./config";
import {
  fetchEdgePlaceDetails,
  fetchEdgePlacesAutocomplete,
  type PlacesServiceError,
} from "./edgeProxy";
import { mapPlaceDetailsFromApi } from "./normalize";
import type {
  GooglePlaceDetails,
  GooglePlacesAutocompleteMode,
  GooglePlaceSuggestion,
} from "./types";

export class GooglePlacesUnavailableError extends Error {
  readonly code: PlacesServiceError["code"];

  constructor(message: string, code: PlacesServiceError["code"] = "unknown") {
    super(message);
    this.name = "GooglePlacesUnavailableError";
    this.code = code;
  }
}

const normalizePlaceIdForNewApi = (placeId: string) =>
  placeId.trim().replace(/^places\//, "");

const fetchNewPlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  signal?: AbortSignal,
): Promise<
  | { ok: true; data: GooglePlaceSuggestion[] }
  | { ok: false; status: number; detail?: string }
> => {
  const body: Record<string, unknown> = {
    input: input.trim(),
    languageCode: "en",
    regionCode: "US",
  };

  if (mode === "business") {
    body.includedPrimaryTypes = ["establishment"];
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
    const detail = await response.text().catch(() => "");
    if (import.meta.env.DEV) {
      console.warn(
        "[Google Places] autocomplete (New API) failed:",
        response.status,
        detail,
      );
    }
    return { ok: false, status: response.status, detail };
  }

  const payload = (await response.json()) as {
    suggestions?: Array<{
      placePrediction?: { placeId?: string; text?: { text?: string } };
    }>;
  };

  const data =
    payload.suggestions
      ?.map((item) => ({
        placeId: normalizePlaceIdForNewApi(
          String(item.placePrediction?.placeId ?? ""),
        ),
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

  const newResult = await fetchNewPlacesAutocomplete(input, mode, signal);
  if (newResult.ok) {
    return newResult.data;
  }

  const proxyResult = await fetchEdgePlacesAutocomplete(input, mode, signal);
  if (proxyResult.suggestions.length > 0) {
    return proxyResult.suggestions;
  }

  if (proxyResult.error) {
    throw new GooglePlacesUnavailableError(
      proxyResult.error.message,
      proxyResult.error.code,
    );
  }

  if (newResult.status === 403) {
    throw new GooglePlacesUnavailableError(
      "Google Places API (New) denied this request. Enable billing, Places API (New), and Places API in Google Cloud, and allow your site URL in the API key referrers.",
      "permission_denied",
    );
  }

  return [];
};

const fetchNewPlaceDetails = async (
  placeId: string,
  signal?: AbortSignal,
): Promise<GooglePlaceDetails | null | "forbidden"> => {
  const normalizedId = normalizePlaceIdForNewApi(placeId);
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(normalizedId)}`,
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
  return mapPlaceDetailsFromApi(normalizedId, payload);
};

export const fetchGooglePlaceDetails = async (
  placeId: string,
  signal?: AbortSignal,
): Promise<GooglePlaceDetails | null> => {
  if (!isGooglePlacesEnabled() || !placeId.trim()) {
    return null;
  }

  const result = await fetchNewPlaceDetails(placeId, signal);
  if (result === "forbidden") {
    const proxyResult = await fetchEdgePlaceDetails(placeId, signal);
    return proxyResult.details;
  }
  if (result) {
    return result;
  }

  const proxyResult = await fetchEdgePlaceDetails(placeId, signal);
  return proxyResult.details;
};
