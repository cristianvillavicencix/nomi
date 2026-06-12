import { describe, expect, it } from "vitest";
import {
  normalizeAddressPipeline,
  verifyIdempotentSecondPass,
} from "./addressNormalize";
import {
  countCityOccurrences,
  stripEmbeddedLocationSuffix,
} from "./addressSuffixStrip";

describe("stripEmbeddedLocationSuffix", () => {
  it("keeps city name in street when only suffix matches (Danbury Rd case)", () => {
    expect(
      stripEmbeddedLocationSuffix("123 Danbury Rd, Danbury, CT 06811", {
        city: "Danbury",
        stateAbbr: "CT",
        zipcode: "06811",
      }),
    ).toBe("123 Danbury Rd");
  });

  it("strips comma-separated Zoho suffix with country", () => {
    expect(
      stripEmbeddedLocationSuffix(
        "71 Bennett Avenue, Waterbury, CT, 06708, U.S.A",
        {
          city: "Waterbury",
          stateAbbr: "CT",
          zipcode: "06708",
          country: "U.S.A",
        },
      ),
    ).toBe("71 Bennett Avenue");
  });

  it("does not strip when city only appears inside street name", () => {
    expect(
      stripEmbeddedLocationSuffix("123 Danbury Rd, Hartford, CT 06103", {
        city: "Danbury",
        stateAbbr: "CT",
        zipcode: "06811",
      }),
    ).toBeNull();
  });

  it("is idempotent on already-normalized street", () => {
    expect(
      stripEmbeddedLocationSuffix("123 Danbury Rd", {
        city: "Danbury",
        stateAbbr: "CT",
        zipcode: "06811",
      }),
    ).toBeNull();
  });
});

describe("address normalize idempotency", () => {
  it("second pass produces zero changes after embedded-city strip", () => {
    const rows = [
      {
        id: 1,
        address: "123 Danbury Rd, Danbury, CT 06811",
        city: "Danbury",
        state_abbr: "CT",
        zipcode: "06811",
      },
      {
        id: 2,
        address: "71 Bennett Avenue, Waterbury, CT, 06708, U.S.A",
        city: "Waterbury",
        state_abbr: "CT",
        zipcode: "06708",
        country: "U.S.A",
      },
    ];
    const result = verifyIdempotentSecondPass(rows, new Map());
    expect(result.firstPassCount).toBe(2);
    expect(result.secondPassCount).toBe(0);
  });

  it("pipeline leaves normalized row unchanged on re-run", () => {
    const rows = [
      {
        id: 99,
        address: "123 Danbury Rd, Danbury, CT 06811",
        city: "Danbury",
        state_abbr: "CT",
        zipcode: "06811",
      },
    ];
    const first = normalizeAddressPipeline(rows, new Map());
    expect(first).toHaveLength(1);
    const normalized = [
      {
        ...rows[0],
        address: first[0].proposal.street,
      },
    ];
    const second = normalizeAddressPipeline(normalized, new Map());
    expect(second).toHaveLength(0);
  });
});

describe("countCityOccurrences", () => {
  it("flags duplicate city tokens in address", () => {
    expect(countCityOccurrences("123 Danbury Rd, Danbury, CT 06811", "Danbury")).toBe(
      2,
    );
  });
});
