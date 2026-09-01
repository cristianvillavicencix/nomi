import { describe, expect, it } from "vitest";
import {
  mapPlaceDetailsFromApi,
  resolveStreetLine,
  streetLineFromFormattedAddress,
} from "./normalize";

describe("resolveStreetLine", () => {
  it("prefers streetLine from address components over formatted address", () => {
    expect(
      resolveStreetLine({
        streetLine: "320 Ocean Pkwy",
        formattedAddress: "320 Ocean Pkwy, Brooklyn, NY 11218, USA",
      }),
    ).toBe("320 Ocean Pkwy");
  });

  it("falls back to the first comma segment of formatted address", () => {
    expect(
      streetLineFromFormattedAddress(
        "320 Ocean Pkwy, Brooklyn, NY 11218, USA",
      ),
    ).toBe("320 Ocean Pkwy");
  });
});

describe("mapPlaceDetailsFromApi city resolution", () => {
  it("uses sublocality when locality is missing (NYC boroughs)", () => {
    const details = mapPlaceDetailsFromApi("place-1", {
      formattedAddress: "320 Ocean Pkwy, Brooklyn, NY 11218, USA",
      addressComponents: [
        {
          types: ["street_number"],
          longText: "320",
        },
        {
          types: ["route"],
          longText: "Ocean Pkwy",
        },
        {
          types: ["sublocality_level_1", "political"],
          longText: "Brooklyn",
        },
        {
          types: ["administrative_area_level_1", "political"],
          shortText: "NY",
        },
        {
          types: ["postal_code"],
          longText: "11218",
        },
        {
          types: ["country", "political"],
          shortText: "US",
        },
      ],
    });

    expect(details.streetLine).toBe("320 Ocean Pkwy");
    expect(details.city).toBe("Brooklyn");
    expect(details.stateAbbr).toBe("NY");
    expect(details.zipcode).toBe("11218");
  });
});
