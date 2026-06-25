import { describe, expect, it } from "vitest";
import {
  isExactCompanyNameMatch,
  normalizeCompanyNameForMatch,
} from "./useCompanyNameDuplicateCheck";

describe("normalizeCompanyNameForMatch", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeCompanyNameForMatch("  Latino   Business Support  ")).toBe(
      "latino business support",
    );
  });
});

describe("isExactCompanyNameMatch", () => {
  it("matches case-insensitively", () => {
    expect(
      isExactCompanyNameMatch(
        "Latino Business Support",
        "latino business support",
      ),
    ).toBe(true);
  });

  it("does not match partial names", () => {
    expect(isExactCompanyNameMatch("Latino", "Latino Business Support")).toBe(
      false,
    );
  });
});
