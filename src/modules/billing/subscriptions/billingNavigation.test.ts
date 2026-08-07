import { describe, expect, it } from "vitest";
import {
  buildBillingTabSearchParams,
  resolveBillingTab,
} from "@/modules/billing/subscriptions/billingNavigation";

describe("billingNavigation", () => {
  it("defaults to invoices tab", () => {
    expect(resolveBillingTab(new URLSearchParams())).toBe("invoices");
    expect(resolveBillingTab(new URLSearchParams("tab=invoices"))).toBe(
      "invoices",
    );
    expect(resolveBillingTab(new URLSearchParams("tab=subscriptions"))).toBe(
      "subscriptions",
    );
  });

  it("preserves invoice workspace when on invoices tab", () => {
    const current = new URLSearchParams("invoice=42&tab=invoices");
    expect(
      Object.fromEntries(buildBillingTabSearchParams("invoices", current)),
    ).toEqual({ invoice: "42" });
  });

  it("preserves subscription selection on subscriptions tab", () => {
    const current = new URLSearchParams("tab=subscriptions&subscription=9");
    expect(
      Object.fromEntries(buildBillingTabSearchParams("subscriptions", current)),
    ).toEqual({ tab: "subscriptions", subscription: "9" });
  });
});
