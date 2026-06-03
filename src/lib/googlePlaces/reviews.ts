import { getGooglePlacesApiKey, isGooglePlacesEnabled } from "./config";

const LEGACY_BASE = "https://maps.googleapis.com/maps/api/place";

export type GooglePlaceReview = {
  authorName: string;
  rating: number;
  text: string;
  relativeTime?: string;
  profilePhotoUrl?: string;
};

export type GooglePlaceReviewsResult = {
  rating: number | null;
  userRatingCount: number | null;
  reviews: GooglePlaceReview[];
};

/** Fetch public Google Business reviews for a place (legacy Places Details API). */
export const fetchGooglePlaceReviews = async (
  placeId: string,
  signal?: AbortSignal,
): Promise<GooglePlaceReviewsResult | null> => {
  if (!isGooglePlacesEnabled() || !placeId.trim()) return null;

  const params = new URLSearchParams({
    place_id: placeId.trim(),
    key: getGooglePlacesApiKey(),
    language: "en",
    fields: "reviews,rating,user_ratings_total",
  });

  const response = await fetch(
    `${LEGACY_BASE}/details/json?${params.toString()}`,
    { signal },
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    status?: string;
    result?: {
      rating?: number;
      user_ratings_total?: number;
      reviews?: Array<{
        author_name?: string;
        rating?: number;
        text?: string;
        relative_time_description?: string;
        profile_photo_url?: string;
      }>;
    };
  };

  if (payload.status !== "OK" || !payload.result) return null;

  const reviews = (payload.result.reviews ?? [])
    .filter((row) => row.text?.trim())
    .slice(0, 6)
    .map((row) => ({
      authorName: String(row.author_name ?? "Client"),
      rating: Number(row.rating ?? 5),
      text: String(row.text ?? "").trim(),
      relativeTime: row.relative_time_description,
      profilePhotoUrl: row.profile_photo_url,
    }));

  return {
    rating: payload.result.rating ?? null,
    userRatingCount: payload.result.user_ratings_total ?? null,
    reviews,
  };
};
