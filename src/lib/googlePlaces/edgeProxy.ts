import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { readSupabaseFunctionErrorMessage } from "@/lib/supabaseEdgeFunction";
import type {
  GooglePlaceDetails,
  GooglePlacesAutocompleteMode,
  GooglePlaceSuggestion,
} from "./types";

export type PlacesServiceError = {
  code: "permission_denied" | "not_configured" | "unauthorized" | "unknown";
  message: string;
};

export type PlacesAutocompleteResult = {
  suggestions: GooglePlaceSuggestion[];
  error?: PlacesServiceError;
};

export type PlacesDetailsResult = {
  details: GooglePlaceDetails | null;
  error?: PlacesServiceError;
};

const mapHttpStatusToError = (
  status: number,
  message: string,
): PlacesServiceError => {
  if (status === 401) {
    return {
      code: "unauthorized",
      message: "Sign in again to use address autocomplete.",
    };
  }
  if (status === 503) {
    return {
      code: "not_configured",
      message:
        "Google Places is not configured on the server (GOOGLE_PLACES_API_KEY secret).",
    };
  }
  if (status === 403) {
    return {
      code: "permission_denied",
      message:
        "Google denied Places requests. Enable billing and Places API (New) + Places API in Google Cloud.",
    };
  }
  return { code: "unknown", message };
};

const invokeGooglePlacesFunction = async <T>(body: Record<string, unknown>) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw Object.assign(new Error("You must be signed in to use address autocomplete"), {
      placesError: {
        code: "unauthorized",
        message: "You must be signed in to use address autocomplete.",
      } satisfies PlacesServiceError,
    });
  }

  const { data, error } = await supabase.functions.invoke<T>("google_places", {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
    },
  });

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    const message = await readSupabaseFunctionErrorMessage(
      error,
      "Google Places proxy request failed",
    );
    const placesError = mapHttpStatusToError(status ?? 500, message);
    throw Object.assign(new Error(placesError.message), { placesError });
  }

  return data;
};

export const fetchEdgePlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  signal?: AbortSignal,
): Promise<PlacesAutocompleteResult> => {
  if (signal?.aborted) {
    return { suggestions: [] };
  }

  try {
    const payload = await invokeGooglePlacesFunction<{
      suggestions?: GooglePlaceSuggestion[];
      googleError?: string;
    }>({
      action: "autocomplete",
      input,
      mode,
    });

    if (signal?.aborted) {
      return { suggestions: [] };
    }

    if (payload?.googleError) {
      return {
        suggestions: payload.suggestions ?? [],
        error: {
          code: "permission_denied",
          message: payload.googleError,
        },
      };
    }

    return { suggestions: payload?.suggestions ?? [] };
  } catch (error) {
    const placesError = (error as { placesError?: PlacesServiceError }).placesError;
    return {
      suggestions: [],
      error: placesError ?? {
        code: "unknown",
        message:
          error instanceof Error
            ? error.message
            : "Google Places proxy request failed",
      },
    };
  }
};

export const fetchEdgePlaceDetails = async (
  placeId: string,
  signal?: AbortSignal,
): Promise<PlacesDetailsResult> => {
  if (signal?.aborted) {
    return { details: null };
  }

  try {
    const payload = await invokeGooglePlacesFunction<{
      details?: GooglePlaceDetails | null;
      googleError?: string;
    }>({
      action: "details",
      placeId,
    });

    if (signal?.aborted) {
      return { details: null };
    }

    if (payload?.googleError) {
      return {
        details: payload?.details ?? null,
        error: {
          code: "permission_denied",
          message: payload.googleError,
        },
      };
    }

    return { details: payload?.details ?? null };
  } catch (error) {
    const placesError = (error as { placesError?: PlacesServiceError }).placesError;
    return {
      details: null,
      error: placesError ?? {
        code: "unknown",
        message:
          error instanceof Error
            ? error.message
            : "Google Places proxy request failed",
      },
    };
  }
};
