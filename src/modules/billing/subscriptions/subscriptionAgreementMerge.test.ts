import { describe, expect, it } from "vitest";
import { getWebMaintenanceContractTermsSeed } from "@/modules/proposals/maintenanceContractTerms";
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

  it("fills leftovers when staff pasted an unmerged template", () => {
    const raw =
      "Client {{client_name}} at {{client_address}}. Total {{total_amount}}.";
    expect(
      mergeSubscriptionContractTerms(raw, {
        client_name: "Acme",
        client_address: "1 Main",
        total_amount: "$10.00",
      }),
    ).toBe("Client Acme at 1 Main. Total $10.00.");
  });
});

describe("hasUnmergedContractPlaceholders", () => {
  it("detects brace placeholders", async () => {
    const { hasUnmergedContractPlaceholders } = await import(
      "./subscriptionAgreementMerge"
    );
    expect(hasUnmergedContractPlaceholders("Hi {{client_name}}")).toBe(true);
    expect(hasUnmergedContractPlaceholders("Hi Acme")).toBe(false);
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
    expect(vars.client_company).toBe("Jane Doe");
    expect(vars.client_representative).toBe("—");
    expect(vars.total_amount).toContain("99");
    expect(vars.line_items).toContain("Care plan");
    expect(vars.subscription_number_line).toBe(" (SUB-1)");
    expect(vars.proposal_number).toBe("SUB-1");
  });

  it("keeps company and representative distinct", () => {
    const vars = buildSubscriptionContractVariables({
      clientName: "Acme LLC",
      clientRepresentative: "Jane Doe",
      subscriptionDescription: "Monthly ads support",
      subscriptionName: "Ads",
      amount: 50,
      billingInterval: "monthly",
      lineItems: [],
      termsVersion: "1.0",
    });
    expect(vars.client_name).toBe("Acme LLC");
    expect(vars.client_representative).toBe("Jane Doe");
    expect(vars.subscription_description_line).toContain("Monthly ads support");
  });

  it("merges the web maintenance contract template", () => {
    const seed = getWebMaintenanceContractTermsSeed();
    const vars = buildSubscriptionContractVariables({
      clientName: "Acme LLC",
      clientAddress: "320 Ocean Pkwy",
      clientRepresentative: "Jane Doe",
      subscriptionName: "Website maintenance",
      subscriptionNumber: "SUB-2026-0042",
      amount: 80,
      billingInterval: "monthly",
      lineItems: [{ description: "Website maintenance", quantity: 1, unit_price: 80 }],
      termsVersion: seed.version,
      defaultVariables: seed.default_variables,
    });
    const merged = mergeSubscriptionContractTerms(seed.body_markdown, vars);
    expect(merged).toContain("Acme LLC");
    expect(merged).toContain("Jane Doe");
    expect(merged).toContain("Website maintenance");
    expect(merged).toContain("SUB-2026-0042");
    expect(merged).toContain("Latino Business Support");
    expect(merged).toContain("2 horas/mes");
    expect(merged).toContain("60");
    expect(merged).toContain("15");
    expect(merged).not.toMatch(/\{\{\w+\}\}/);
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
