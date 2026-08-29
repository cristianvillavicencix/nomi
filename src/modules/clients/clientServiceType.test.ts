import { describe, expect, it } from "vitest";
import {
  deriveClientServiceType,
  deriveContactServiceType,
  formatInterestedServicesLabel,
  parseInterestedServiceType,
} from "./clientServiceType";

describe("deriveClientServiceType", () => {
  it("returns website when the company has deals only", () => {
    expect(
      deriveClientServiceType({
        dealCount: 2,
        ticketCount: 0,
        invoiceCount: 0,
      }),
    ).toBe("website");
  });

  it("returns xactimate when the company has tickets only", () => {
    expect(
      deriveClientServiceType({
        dealCount: 0,
        ticketCount: 3,
        invoiceCount: 0,
      }),
    ).toBe("xactimate");
  });

  it("returns xactimate when the company has invoices only", () => {
    expect(
      deriveClientServiceType({
        dealCount: 0,
        ticketCount: 0,
        invoiceCount: 1,
      }),
    ).toBe("xactimate");
  });

  it("returns both when the company has deals and tickets", () => {
    expect(
      deriveClientServiceType({
        dealCount: 1,
        ticketCount: 1,
        invoiceCount: 0,
      }),
    ).toBe("both");
  });

  it("returns both when the company has deals and invoices", () => {
    expect(
      deriveClientServiceType({
        dealCount: 1,
        ticketCount: 0,
        invoiceCount: 2,
      }),
    ).toBe("both");
  });

  it("returns both when the company has deals, tickets, and invoices", () => {
    expect(
      deriveClientServiceType({
        dealCount: 5,
        ticketCount: 2,
        invoiceCount: 4,
      }),
    ).toBe("both");
  });

  it("returns null when there is no qualifying activity", () => {
    expect(
      deriveClientServiceType({
        dealCount: 0,
        ticketCount: 0,
        invoiceCount: 0,
      }),
    ).toBeNull();
  });
});

describe("parseInterestedServiceType", () => {
  it("maps Sitio web to website", () => {
    expect(parseInterestedServiceType("Sitio web")).toBe("website");
  });

  it("maps Xactimate to xactimate", () => {
    expect(parseInterestedServiceType("Xactimate")).toBe("xactimate");
  });

  it("maps mixed interest to both", () => {
    expect(parseInterestedServiceType("Sitio web, Xactimate")).toBe("both");
  });

  it("returns null for unrelated services", () => {
    expect(parseInterestedServiceType("Otro")).toBeNull();
  });
});

describe("deriveContactServiceType", () => {
  it("uses declared interest when there is no activity yet", () => {
    expect(
      deriveContactServiceType({
        interestedService: "Xactimate",
        dealCount: 0,
        ticketCount: 0,
        invoiceCount: 0,
      }),
    ).toBe("xactimate");
  });

  it("merges interest and activity into both", () => {
    expect(
      deriveContactServiceType({
        interestedService: "Sitio web",
        dealCount: 0,
        ticketCount: 2,
        invoiceCount: 0,
      }),
    ).toBe("both");
  });
});

describe("formatInterestedServicesLabel", () => {
  it("localizes legacy Spanish labels for display", () => {
    expect(formatInterestedServicesLabel("Sitio web, Redes sociales")).toBe(
      "Website, Social media",
    );
  });
});
