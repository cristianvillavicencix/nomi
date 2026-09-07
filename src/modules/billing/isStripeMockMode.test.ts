import { describe, expect, it } from "vitest";

/** Mirrors isStripeMockMode() in supabase/functions/_shared/clientProposalBilling.ts */
const isStripeMockMode = (skip: string | undefined) => {
  const normalized = skip?.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
};

describe("isStripeMockMode", () => {
  it("is off when SKIP_CLIENT_BILLING is unset even without a Stripe key", () => {
    expect(isStripeMockMode(undefined)).toBe(false);
    expect(isStripeMockMode("")).toBe(false);
  });

  it("is on only for explicit skip flags", () => {
    expect(isStripeMockMode("1")).toBe(true);
    expect(isStripeMockMode("true")).toBe(true);
    expect(isStripeMockMode("YES")).toBe(true);
    expect(isStripeMockMode("on")).toBe(true);
    expect(isStripeMockMode("0")).toBe(false);
  });
});
