import { describe, expect, it } from "vitest";
import {
  buildSubscriptionListFilter,
  buildSubscriptionBankStatementPreview,
  formatSubscriptionAmountLabel,
  formatSubscriptionNextBillingLabel,
  isSubscriptionExpired,
  subscriptionMatchesStatusFilter,
  subscriptionStatusLabel,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";

describe("subscriptionDisplayUtils", () => {
  it("maps status filters for list queries", () => {
    expect(buildSubscriptionListFilter("all")).toEqual({});
    expect(buildSubscriptionListFilter("expired")).toEqual({});
    expect(buildSubscriptionListFilter("active")).toEqual({
      "status@eq": "active",
    });
  });

  it("derives expired status from ends_at", () => {
    const row = {
      status: "active" as const,
      ends_at: "2020-01-01T00:00:00.000Z",
    };
    expect(isSubscriptionExpired(row)).toBe(true);
    expect(subscriptionStatusLabel("active", row)).toBe("Expired");
    expect(subscriptionMatchesStatusFilter(row as never, "expired")).toBe(true);
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

  it("formats next billing labels for list cards", () => {
    expect(
      formatSubscriptionNextBillingLabel({
        status: "pending_setup",
        next_billing_at: null,
      }),
    ).toBe("Setup pending");
    expect(
      formatSubscriptionNextBillingLabel({
        status: "active",
        next_billing_at: "2026-08-15",
      }),
    ).toBe("Next billing · Aug 15, 2026");
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
