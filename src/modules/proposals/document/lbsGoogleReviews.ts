import { useQuery } from "@tanstack/react-query";
import { fetchGooglePlaceReviews } from "@/lib/googlePlaces/reviews";

/** Latinos Business Support — Google Business Profile place id (Places API). */
export const getLbsGooglePlaceId = () =>
  import.meta.env.VITE_LBS_GOOGLE_PLACE_ID?.trim() ?? "";

export const useLbsGoogleReviews = (enabled = true) => {
  const placeId = getLbsGooglePlaceId();
  return useQuery({
    queryKey: ["lbs-google-reviews", placeId],
    queryFn: ({ signal }) => fetchGooglePlaceReviews(placeId, signal),
    enabled: enabled && Boolean(placeId),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
};
