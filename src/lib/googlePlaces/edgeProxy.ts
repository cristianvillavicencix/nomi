import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type {
  GooglePlaceDetails,
  GooglePlacesAutocompleteMode,
  GooglePlaceSuggestion,
} from "./types";

const invokeGooglePlacesFunction = async <T>(body: Record<string, unknown>) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("You must be signed in to use address autocomplete");
  }

  const { data, error } = await supabase.functions.invoke<T>("google_places", {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
    },
  });

  if (error) {
    const message =
      error.message ||
      (typeof error === "object" && error !== null && "context" in error
        ? `Request failed (${(error as { context?: { status?: number } }).context?.status ?? "unknown"})`
        : "Google Places proxy request failed");
    throw new Error(message);
  }

  return data;
};

export const fetchEdgePlacesAutocomplete = async (
  input: string,
  mode: GooglePlacesAutocompleteMode,
  signal?: AbortSignal,
): Promise<GooglePlaceSuggestion[]> => {
  if (signal?.aborted) return [];

  const payload = await invokeGooglePlacesFunction<{
    suggestions?: GooglePlaceSuggestion[];
  }>({
    action: "autocomplete",
    input,
    mode,
  });

  if (signal?.aborted) return [];
  return payload?.suggestions ?? [];
};

export const fetchEdgePlaceDetails = async (
  placeId: string,
  signal?: AbortSignal,
): Promise<GooglePlaceDetails | null> => {
  if (signal?.aborted) return null;

  const payload = await invokeGooglePlacesFunction<{
    details?: GooglePlaceDetails | null;
  }>({
    action: "details",
    placeId,
  });

  if (signal?.aborted) return null;
  return payload?.details ?? null;
};
