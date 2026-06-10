import { describe, expect, it } from "vitest";
import { resolveCompanyAddressForDisplay } from "./clientAddressUtils";

describe("resolveCompanyAddressForDisplay", () => {
  it("composes from structured columns when present", () => {
    expect(
      resolveCompanyAddressForDisplay({
        address: "71 Bennett Avenue, Waterbury, CT, 06708, U.S.A",
        city: "Waterbury",
        state_abbr: "CT",
        zipcode: "06708",
        country: "U.S.A",
      }),
    ).toBe("71 Bennett Avenue · Waterbury, CT 06708 · U.S.A");
  });

  it("falls back to raw address when structured columns are empty", () => {
    expect(
      resolveCompanyAddressForDisplay({
        address: "123 Heminway Avenue, East Haven, CT, 06512, U.S.A",
        city: null,
        state_abbr: null,
        zipcode: null,
        country: null,
      }),
    ).toBe("123 Heminway Avenue, East Haven, CT, 06512, U.S.A");
  });

  it("uses first line only for multiline blobs without columns", () => {
    expect(
      resolveCompanyAddressForDisplay({
        address:
          "178 Middle River Rd, Danbury, CT, 06811, United States\nDanbury, CT 06811\nUnited States",
        city: null,
        state_abbr: null,
        zipcode: null,
        country: null,
      }),
    ).toBe("178 Middle River Rd, Danbury, CT, 06811, United States");
  });
});
