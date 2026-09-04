import { getGooglePlacesApiKey, isGooglePlacesEnabled } from "./config";
import {
  fetchEdgePlaceDetails,
  fetchEdgePlacesAutocomplete,
  type PlacesServiceError,
} from "./edgeProxy";
import { mapPlaceDetailsFromApi, resolveStreetLine } from "./normalize";
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

const looksLikePostalCode = (input: string) =>
  /^\d{3,5}(-\d{0,4})?$/.test(input.trim());

const fetchNewPlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  signal?: AbortSignal,
  primaryTypes?: string[],
): Promise<
  | { ok: true; data: GooglePlaceSuggestion[] }
  | { ok: false; status: number; detail?: string }
> => {
  const body: Record<string, unknown> = {
    input: input.trim(),
    languageCode: "en",
    regionCode: "US",
  };

  if (mode === "address") {
    // Hard-filter to US so suggestions look like street + city + state + ZIP
    body.includedRegionCodes = ["us"];
  }

  if (mode === "business") {
    body.includedPrimaryTypes = ["establishment"];
  } else if (primaryTypes?.length) {
    body.includedPrimaryTypes = primaryTypes;
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

const mergeSuggestions = (
  ...lists: GooglePlaceSuggestion[][]
): GooglePlaceSuggestion[] => {
  const seen = new Set<string>();
  const merged: GooglePlaceSuggestion[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.placeId)) continue;
      seen.add(item.placeId);
      merged.push(item);
      if (merged.length >= 8) return merged;
    }
  }
  return merged;
};

export const fetchPlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  signal?: AbortSignal,
): Promise<GooglePlaceSuggestion[]> => {
  if (!isGooglePlacesEnabled() || input.trim().length < 3) {
    return [];
  }

  // Prefer the Supabase proxy: avoids browser referrer restrictions and CORS.
  const proxyResult = await fetchEdgePlacesAutocomplete(input, mode, signal);
  if (proxyResult.suggestions.length > 0) {
    return proxyResult.suggestions;
  }

  const newResult = await fetchNewPlacesAutocomplete(input, mode, signal);
  if (newResult.ok) {
    // ZIP / postal: also pull postal_code predictions and merge
    if (mode === "address" && looksLikePostalCode(input)) {
      const zipResult = await fetchNewPlacesAutocomplete(
        input,
        mode,
        signal,
        ["postal_code"],
      );
      if (zipResult.ok) {
        return mergeSuggestions(zipResult.data, newResult.data);
      }
    }
    return newResult.data;
  }

  if (proxyResult.error) {
    throw new GooglePlacesUnavailableError(
      proxyResult.error.message,
      proxyResult.error.code,
    );
  }

  if (newResult.status === 403) {
    throw new GooglePlacesUnavailableError(
      "Google Places is unavailable. Enable billing, Places API (New), and Places API in Google Cloud, then set GOOGLE_PLACES_API_KEY on Supabase and VITE_GOOGLE_PLACES_API_KEY in the app.",
      "permission_denied",
    );
  }

  return [];
};

/** Prefer full formatted addresses (with ZIP) for suggestion labels. */
export const enrichPlaceSuggestionsWithAddresses = async (
  suggestions: GooglePlaceSuggestion[],
  signal?: AbortSignal,
): Promise<GooglePlaceSuggestion[]> => {
  if (suggestions.length === 0) return suggestions;

  const enriched = await Promise.all(
    suggestions.slice(0, 6).map(async (item) => {
      if (signal?.aborted) return item;
      // Already looks like a full US line with ZIP — keep as-is
      if (/\b\d{5}(-\d{4})?\b/.test(item.text)) return item;
      try {
        const details = await fetchGooglePlaceDetails(item.placeId, signal);
        const formatted = details?.formattedAddress?.trim();
        if (formatted) {
          return { placeId: item.placeId, text: formatted };
        }
      } catch {
        // keep original prediction text
      }
      return item;
    }),
  );

  return enriched;
};

const withStreetLine = (details: GooglePlaceDetails): GooglePlaceDetails => ({
  ...details,
  streetLine:
    details.streetLine?.trim() ||
    resolveStreetLine({ streetLine: "", formattedAddress: details.formattedAddress }),
});

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

  const proxyResult = await fetchEdgePlaceDetails(placeId, signal);
  if (proxyResult.details) {
    return withStreetLine(proxyResult.details);
  }

  const result = await fetchNewPlaceDetails(placeId, signal);
  if (result === "forbidden") {
    return null;
  }
  if (result) {
    return withStreetLine(result);
  }

  return proxyResult.details;
};
