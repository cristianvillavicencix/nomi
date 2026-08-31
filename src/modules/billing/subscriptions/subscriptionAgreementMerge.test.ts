import { describe, expect, it } from "vitest";
import {
  buildSubscriptionContractVariables,
  mergeSubscriptionContractTerms,
  resolveDefaultContractTermsIdFromPackages,
} from "./subscriptionAgreementMerge";

describe("mergeSubscriptionContractTerms", () => {
  it("replaces known variables and blanks missing ones", () => {
    expect(
      mergeSubscriptionContractTerms(
        "Hello {{client_name}} — {{missing}}.",
        { client_name: "Acme LLC" },
      ),
    ).toBe("Hello Acme LLC — .");
  });
});

describe("buildSubscriptionContractVariables", () => {
  it("fills client, plan, and recurring fields", () => {
    const vars = buildSubscriptionContractVariables({
      clientName: "Jane Doe",
      clientAddress: "1 Main St",
      subscriptionName: "Web Maintenance",
      subscriptionNumber: "SUB-1",
      amount: 99,
      currency: "USD",
      billingInterval: "monthly",
      lineItems: [{ description: "Care plan", quantity: 1, unit_price: 99 }],
      termsVersion: "1.0",
    });
    expect(vars.client_name).toBe("Jane Doe");
    expect(vars.total_amount).toContain("99");
    expect(vars.line_items).toContain("Care plan");
    expect(vars.subscription_number_line).toBe(" (SUB-1)");
    expect(vars.proposal_number).toBe("SUB-1");
  });
});

describe("resolveDefaultContractTermsIdFromPackages", () => {
  it("prefers first line package link, then org default", () => {
    const packagesById = new Map([
      [10, { default_contract_terms_id: 55 }],
      [11, { default_contract_terms_id: null }],
    ]);
    expect(
      resolveDefaultContractTermsIdFromPackages({
        lineItems: [{ package_id: 11 }, { package_id: 10 }],
        packagesById,
        orgDefaultTermsId: 99,
      }),
    ).toBe(55);

    expect(
      resolveDefaultContractTermsIdFromPackages({
        lineItems: [{ package_id: 11 }],
        packagesById,
        orgDefaultTermsId: 99,
        activeTermsIds: [99, 12],
      }),
    ).toBe(99);
  });
});
