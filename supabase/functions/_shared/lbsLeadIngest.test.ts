import { describe, expect, it } from "vitest";
import {
  buildLeadBackground,
  mapPrimaryCategoryToSector,
  normalizeLbsLeadPayload,
  normalizeWebsite,
  normalizeWebsiteHost,
  splitPersonName,
  validateLbsLeadPayload,
} from "./lbsLeadIngestLogic.ts";

describe("normalizeWebsite", () => {
  it("adds https when missing", () => {
    expect(normalizeWebsite("example.com")).toBe("https://example.com");
  });

  it("keeps existing scheme", () => {
    expect(normalizeWebsite("http://example.com")).toBe("http://example.com");
  });
});

describe("normalizeWebsiteHost", () => {
  it("strips www for dedupe", () => {
    expect(normalizeWebsiteHost("https://www.example.com/path")).toBe(
      "example.com",
    );
  });
});

describe("splitPersonName", () => {
  it("splits first and last name", () => {
    expect(splitPersonName("Maria Garcia")).toEqual({
      first_name: "Maria",
      last_name: "Garcia",
    });
  });
});

describe("mapPrimaryCategoryToSector", () => {
  it("maps roofing categories", () => {
    expect(mapPrimaryCategoryToSector("Roofing contractor")).toBe("roofing");
  });
});

describe("validateLbsLeadPayload", () => {
  it("accepts unlock payload with contact channels", () => {
    expect(
      validateLbsLeadPayload({
        source: "lbs-unlock",
        contact: {
          name: "Test LBS",
          email: "test@example.com",
        },
        businessName: "Test Roofing LLC",
      }).ok,
    ).toBe(true);
  });

  it("rejects missing source", () => {
    expect(validateLbsLeadPayload({}).ok).toBe(false);
  });

  it("requires referral business or contact name", () => {
    expect(
      validateLbsLeadPayload({
        source: "lbs-referral",
        referido: { contact: "lead@example.com" },
      }).ok,
    ).toBe(false);
  });
});

describe("normalizeLbsLeadPayload", () => {
  it("maps unlock leads to WebSite Visit", () => {
    const lead = normalizeLbsLeadPayload({
      source: "lbs-unlock",
      contact: { name: "Test LBS", email: "test@example.com" },
      businessName: "Test Roofing LLC",
      website: "example-roofing.com",
      toolKey: "google-audit",
      toolLabel: "Google Audit",
      reportLines: ["Score: 72"],
    });

    expect(lead.leadSource).toBe("WebSite Visit");
    expect(lead.website).toBe("https://example-roofing.com");
    expect(lead.shouldCreateDeal).toBe(false);
    expect(lead.background).toContain("Google Audit");
    expect(lead.background).toContain("- Score: 72");
  });

  it("maps referral leads to Referido and captures referrer context", () => {
    const lead = normalizeLbsLeadPayload({
      source: "lbs-referral",
      referido: {
        business: "ABC LLC",
        name: "Carlos",
        contact: "carlos@abc.com",
      },
      referidor: {
        name: "Juan Perez",
        email: "juan@email.com",
      },
    });

    expect(lead.leadSource).toBe("Referido");
    expect(lead.businessName).toBe("ABC LLC");
    expect(lead.contactEmail).toBe("carlos@abc.com");
    expect(lead.background).toContain("Referrer name: Juan Perez");
  });
});

describe("buildLeadBackground", () => {
  it("joins notes and report lines", () => {
    expect(
      buildLeadBackground({
        notes: "Needs website",
        reportLines: ["Missing schema"],
        toolLabel: "Audit",
      }),
    ).toBe("Needs website\n- Missing schema\nTool: Audit");
  });
});
