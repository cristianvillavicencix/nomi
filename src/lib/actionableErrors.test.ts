import { describe, it, expect } from "vitest";
import { isKnownInvoiceError, toActionableError } from "./actionableErrors";

describe("toActionableError", () => {
  it("maps Stripe not configured to an actionable message", () => {
    const result = toActionableError(
      new Error("Stripe is not configured. Add your keys under Settings."),
    );
    expect(result.message).toContain("Payment processing is not configured");
    expect(result.action).toContain("Configure Stripe");
  });

  it("maps email not configured", () => {
    const result = toActionableError("Email is not configured for your organization");
    expect(result.message).toContain("Invoice email cannot be sent");
    expect(result.action).toContain("Twilio email");
  });

  it("maps file delivery failure", () => {
    const result = toActionableError("Failed to deliver files after payment");
    expect(result.message).toContain("Payment succeeded, but file delivery failed");
    expect(result.action).toContain("Settings");
  });

  it("keeps unknown errors actionable", () => {
    const result = toActionableError("Something weird happened");
    expect(result.message).toBe("Something weird happened");
    expect(result.action).toContain("contact support");
  });
});

describe("isKnownInvoiceError", () => {
  it("returns true for known patterns", () => {
    expect(isKnownInvoiceError(new Error("Already paid"))).toBe(true);
  });

  it("returns false for unknown errors", () => {
    expect(isKnownInvoiceError("random crash")).toBe(false);
  });
});