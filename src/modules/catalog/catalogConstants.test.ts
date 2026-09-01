import { describe, expect, it } from "vitest";
import {
  catalogFilterOptionsForRows,
  filterCatalogPackages,
} from "./catalogConstants";

const sampleRows = [
  {
    name: "Website Pro",
    category: "web",
    booking_enabled: false,
    ticket_billing_enabled: false,
  },
  {
    name: "Roof measurements",
    category: "tickets",
    booking_enabled: false,
    ticket_billing_enabled: true,
  },
  {
    name: "Consulting call",
    category: "web",
    booking_enabled: true,
    ticket_billing_enabled: false,
  },
];

describe("filterCatalogPackages", () => {
  it("filters by category group and usage flags", () => {
    expect(
      filterCatalogPackages(sampleRows, "group:tickets", "").map((r) => r.name),
    ).toEqual(["Roof measurements"]);
    expect(
      filterCatalogPackages(sampleRows, "usage:book_now", "").map((r) => r.name),
    ).toEqual(["Consulting call"]);
  });

  it("filters by search query", () => {
    expect(filterCatalogPackages(sampleRows, "all", "roof")).toHaveLength(1);
  });
});

describe("catalogFilterOptionsForRows", () => {
  it("includes usage chips only when requested", () => {
    const withUsage = catalogFilterOptionsForRows(sampleRows, {
      includeUsageFilters: true,
    }).map((option) => option.key);
    expect(withUsage).toContain("usage:tickets");
    expect(withUsage).toContain("usage:book_now");

    const withoutUsage = catalogFilterOptionsForRows(sampleRows, {
      includeUsageFilters: false,
    }).map((option) => option.key);
    expect(withoutUsage).not.toContain("usage:tickets");
    expect(withoutUsage).not.toContain("usage:book_now");
  });
});
