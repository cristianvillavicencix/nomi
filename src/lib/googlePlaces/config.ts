/** Public Places API key (restrict by HTTP referrer in Google Cloud Console). */
export const getGooglePlacesApiKey = (): string =>
  String(import.meta.env.VITE_GOOGLE_PLACES_API_KEY ?? "").trim();

export const isGooglePlacesEnabled = (): boolean =>
  getGooglePlacesApiKey().length > 0;
