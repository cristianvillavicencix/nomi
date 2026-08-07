import { describe, expect, it } from "vitest";
import {
  buildSubscriptionListFilter,
  buildSubscriptionBankStatementPreview,
  formatSubscriptionAmountLabel,
  subscriptionStatusLabel,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";

describe("subscriptionDisplayUtils", () => {
  it("maps status filters for list queries", () => {
    expect(buildSubscriptionListFilter("all")).toEqual({});
    expect(buildSubscriptionListFilter("active")).toEqual({
      "status@eq": "active",
    });
  });

  it("returns English status labels", () => {
    expect(subscriptionStatusLabel("pending_setup")).toBe("Pending setup");
    expect(subscriptionStatusLabel("past_due")).toBe("Past due");
  });

  it("formats amount labels with interval suffix", () => {
    expect(formatSubscriptionAmountLabel(99, "USD", "monthly")).toBe(
      "$99.00/mo",
    );
    expect(formatSubscriptionAmountLabel(99, "USD", "weekly")).toBe(
      "$99.00/wk",
    );
    expect(formatSubscriptionAmountLabel(99, "USD", "yearly")).toBe(
      "$99.00/yr",
    );
  });

  it("builds an approximate bank statement label", () => {
    expect(
      buildSubscriptionBankStatementPreview({
        orgName: "Latino Business Support",
        subscriptionName: "Monthly IT Support",
      }),
    ).toBe("LATINO BUS* MONTHLY IT SUPPORT");
  });
});
