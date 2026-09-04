import { describe, expect, it } from "vitest";
import {
  ESSENTIAL_BRIEF_REQUEST,
  FULL_BRIEF_REQUEST,
  filterBriefSections,
  getBriefScopeSummary,
  isEssentialBriefScope,
  isFullBriefScope,
} from "./projectBriefRequestScope";
import { applyCrmContactCompanyToBrief } from "./briefPrefillShared";
import { CONTRACTOR_BRIEF_SECTIONS } from "./contractorBriefSchema";

describe("projectBriefRequestScope", () => {
  it("defines a 5-step essential pack in confirm→…→content order", () => {
    expect(ESSENTIAL_BRIEF_REQUEST.sections).toEqual([
      "confirm_data",
      "about_business",
      "services",
      "brand_style",
      "web_content",
    ]);
    expect(isEssentialBriefScope(ESSENTIAL_BRIEF_REQUEST.sections)).toBe(true);
    expect(getBriefScopeSummary(ESSENTIAL_BRIEF_REQUEST)).toBe(
      "Quick website brief",
    );
  });

  it("orders filtered sections by scope, not schema order", () => {
    const filtered = filterBriefSections(
      CONTRACTOR_BRIEF_SECTIONS,
      ESSENTIAL_BRIEF_REQUEST.sections,
    );
    expect(filtered.map((s) => s.id)).toEqual(ESSENTIAL_BRIEF_REQUEST.sections);
  });

  it("labels full pack", () => {
    expect(isFullBriefScope(FULL_BRIEF_REQUEST.sections)).toBe(true);
    expect(getBriefScopeSummary(FULL_BRIEF_REQUEST)).toBe("Full project brief");
  });
});

describe("applyCrmContactCompanyToBrief", () => {
  it("fills empty contact/company fields and keeps existing values", () => {
    const brief: Record<string, unknown> = {
      contact_email: "keep@example.com",
    };
    applyCrmContactCompanyToBrief(
      brief,
      {
        first_name: "Sam",
        last_name: "Lee",
        email: "sam@example.com",
        phone: "+15550001111",
      },
      {
        name: "Lee Roofing",
        website: "https://lee.example",
        address: "1 Oak St",
        city: "Austin",
        state_abbr: "TX",
        zipcode: "78701",
      },
    );
    expect(brief.contact_email).toBe("keep@example.com");
    expect(brief.contact_first_name).toBe("Sam");
    expect(brief.contact_last_name).toBe("Lee");
    expect(brief.company_name).toBe("Lee Roofing");
    expect(brief.existing_website).toBe("https://lee.example");
    expect(brief.full_address).toBe("1 Oak St, Austin, TX, 78701");
  });
});
