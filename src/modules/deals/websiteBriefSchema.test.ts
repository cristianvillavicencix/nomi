import { describe, expect, it } from "vitest";
import { ESSENTIAL_BRIEF_SECTION_IDS } from "./projectBriefRequestScope";
import {
  getBriefSectionStats,
  getProjectBriefSections,
  getVisibleBriefSections,
} from "./websiteBriefSchema";

describe("getBriefSectionStats", () => {
  it("includes technical section for maintenance (agency website brief)", () => {
    const sections = getVisibleBriefSections("maintenance");
    expect(sections.some((entry) => entry.id === "technical")).toBe(true);
  });

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

  it("marks confirm_data complete when required fields are filled and optionals are empty", () => {
    const section = getVisibleBriefSections("website").find(
      (entry) => entry.id === "confirm_data",
    );
    expect(section).toBeDefined();

    const stats = getBriefSectionStats(section!, {
      contact_first_name: "Alex",
      contact_last_name: "Rivera",
      contact_email: "alex@example.com",
      contact_phone: "+15551234567",
      company_name: "Acme Roofing",
      use_same_contact_for_business: true,
    });

    expect(stats.isComplete).toBe(true);
    expect(Math.round((stats.filled / stats.total) * 100)).toBe(100);
  });

  it("marks optional-only sections complete without every empty field", () => {
    const section = getVisibleBriefSections("website").find(
      (entry) => entry.id === "about_business",
    );
    expect(section).toBeDefined();

    const stats = getBriefSectionStats(section!, {
      target_audience: "Homeowners in Stamford",
      service_areas: "Fairfield County",
    });

    expect(stats.isEmpty).toBe(false);
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

describe("getProjectBriefSections", () => {
  it("defaults to essential pack order for website projects", () => {
    const sections = getProjectBriefSections("website");
    expect(sections.map((section) => section.id)).toEqual(
      ESSENTIAL_BRIEF_SECTION_IDS,
    );
  });

  it("returns all contractor sections for full pack", () => {
    const full = getProjectBriefSections("website", "full");
    const essential = getProjectBriefSections("website", "essential");
    expect(full.length).toBeGreaterThan(essential.length);
    expect(full.map((section) => section.id)).toContain("extras");
  });
});
