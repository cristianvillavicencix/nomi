/** Public Places API key (restrict by HTTP referrer in Google Cloud Console). */
export const getGooglePlacesApiKey = (): string => {
  const fromEnv = String(import.meta.env.VITE_GOOGLE_PLACES_API_KEY ?? "").trim();
  if (fromEnv) return fromEnv;
  return "";
};

export const isGooglePlacesEnabled = (): boolean =>
  getGooglePlacesApiKey().length > 0;
