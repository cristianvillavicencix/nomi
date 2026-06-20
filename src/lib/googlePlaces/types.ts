export type GooglePlacesAutocompleteMode = "address" | "business";

export type GooglePlaceSuggestion = {
  placeId: string;
  text: string;
};

export type GooglePlaceDetails = {
  placeId: string;
  name: string;
  formattedAddress: string;
  /** Street number + route only, e.g. "1200 Summer St". */
  streetLine: string;
  phone: string;
  website: string;
  googleMapsUri: string;
  city: string;
  stateAbbr: string;
  zipcode: string;
  country: string;
};
