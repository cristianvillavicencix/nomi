import { describe, expect, it } from "vitest";
import { deriveClientServiceType } from "./clientServiceType";

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
