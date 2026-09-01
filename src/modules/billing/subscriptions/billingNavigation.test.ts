import { describe, expect, it } from "vitest";
import {
  resolveSubscriptionSubview,
  buildSubscriptionDetailSearchParams,
  buildBillingInvoiceDetailPath,
  resolveBillingTab,
  buildBillingTabSearchParams,
} from "@/modules/billing/subscriptions/billingNavigation";

describe("billingNavigation", () => {
  it("defaults subscription subview to overview", () => {
    expect(
      resolveSubscriptionSubview(new URLSearchParams("tab=subscriptions&subscription=42")),
    ).toBe("overview");
  });

  it("preserves explicit subview values", () => {
    expect(
      resolveSubscriptionSubview(
        new URLSearchParams("tab=subscriptions&subscription=42&subview=edit"),
      ),
    ).toBe("edit");
    expect(
      resolveSubscriptionSubview(
        new URLSearchParams("tab=subscriptions&subscription=42&subview=cards"),
      ),
    ).toBe("cards");
  });

  it("builds subscription detail params without subview for overview", () => {
    const params = buildSubscriptionDetailSearchParams("42", "overview");
    expect(params.get("tab")).toBe("subscriptions");
    expect(params.get("subscription")).toBe("42");
    expect(params.get("subview")).toBeNull();
  });

  it("builds invoice detail path with invoices tab", () => {
    expect(buildBillingInvoiceDetailPath("99")).toBe(
      "/billing?tab=invoices&invoice=99",
    );
  });

  it("resolves reports tab from search params", () => {
    expect(resolveBillingTab(new URLSearchParams("tab=reports"))).toBe(
      "reports",
    );
  });

  it("resolves catalog tab from search params", () => {
    expect(resolveBillingTab(new URLSearchParams("tab=catalog"))).toBe(
      "catalog",
    );
  });

  it("builds catalog tab params without invoice workspace noise", () => {
    const params = buildBillingTabSearchParams(
      "catalog",
      new URLSearchParams("tab=invoices&invoice=99"),
    );
    expect(params.get("tab")).toBe("catalog");
    expect(params.get("invoice")).toBeNull();
  });

  it("preserves report params when switching to reports tab", () => {
    const params = buildBillingTabSearchParams(
      "reports",
      new URLSearchParams(
        "tab=invoices&report=revenue&period=90d&customer=company:42&product=Hosting&churn=2&new_subs=1&new_mrr=99",
      ),
    );
    expect(params.get("tab")).toBe("reports");
    expect(params.get("report")).toBe("revenue");
    expect(params.get("period")).toBe("90d");
    expect(params.get("customer")).toBe("company:42");
    expect(params.get("product")).toBe("Hosting");
    expect(params.get("churn")).toBe("2");
    expect(params.get("new_subs")).toBe("1");
    expect(params.get("new_mrr")).toBe("99");
  });
});
