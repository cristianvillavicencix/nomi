import { describe, expect, it } from "vitest";
import {
  getBriefSectionStats,
  getVisibleBriefSections,
} from "./websiteBriefSchema";

describe("getBriefSectionStats", () => {
  it("counts confirm_data as complete when business contact is shared", () => {
    const section = getVisibleBriefSections("website").find(
      (entry) => entry.id === "confirm_data",
    );
    expect(section).toBeDefined();

    const stats = getBriefSectionStats(section!, {
      contact_first_name: "Armando",
      contact_last_name: "Gahuin",
      contact_email: "armando@example.com",
      contact_phone: "+18453277846",
      company_name: "Armando Landscaping Corp",
      use_same_contact_for_business: true,
      full_address: "42 Cromwell hill Rd, Monroe, NY, 10950",
      existing_website: "https://armandolandscapingcorp.com/",
      social_links: ["Facebook|https://facebook.com/example"],
    });

    expect(stats.filled).toBe(stats.total);
    expect(stats.isComplete).toBe(true);
    expect(Math.round((stats.filled / stats.total) * 100)).toBe(100);
  });

  it("requires separate business contact when the toggle is off", () => {
    const section = getVisibleBriefSections("website").find(
      (entry) => entry.id === "confirm_data",
    );
    expect(section).toBeDefined();

    const stats = getBriefSectionStats(section!, {
      contact_first_name: "Armando",
      contact_last_name: "Gahuin",
      contact_email: "armando@example.com",
      contact_phone: "+18453277846",
      company_name: "Armando Landscaping Corp",
      use_same_contact_for_business: false,
      full_address: "42 Cromwell hill Rd, Monroe, NY, 10950",
      existing_website: "https://armandolandscapingcorp.com/",
      social_links: ["Facebook|https://facebook.com/example"],
    });

    expect(stats.isComplete).toBe(false);
    expect(stats.filled).toBeLessThan(stats.total);
  });
});
