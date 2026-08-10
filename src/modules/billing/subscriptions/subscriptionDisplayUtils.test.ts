import { describe, expect, it } from "vitest";
import {
  buildSubscriptionListFilter,
  buildSubscriptionBankStatementPreview,
  canShowSubscriptionSetupLink,
  canSyncSubscriptionFromStripe,
  formatSubscriptionAmountLabel,
  formatSubscriptionNextBillingLabel,
  hasSubscriptionSetupLink,
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

  it("hides setup link once subscription is active with a card", () => {
    const withLink = {
      status: "active" as const,
      payment_method_last4: "2236",
      setup_share_url: "https://www.nomicrm.com/sub/uGZm36Y",
      setup_checkout_url: null,
      setup_short_code: "uGZm36Y",
    };
    expect(hasSubscriptionSetupLink(withLink)).toBe(true);
    expect(canShowSubscriptionSetupLink(withLink)).toBe(false);
  });

  it("shows setup link for pending setup subscriptions", () => {
    expect(
      canShowSubscriptionSetupLink({
        status: "pending_setup",
        payment_method_last4: null,
        setup_share_url: "https://www.nomicrm.com/sub/abc",
        setup_checkout_url: null,
        setup_short_code: "abc",
      }),
    ).toBe(true);
  });

  it("allows Stripe sync for linked active subscriptions", () => {
    expect(
      canSyncSubscriptionFromStripe({
        status: "active",
        stripe_subscription_id: "sub_123",
      }),
    ).toBe(true);
    expect(
      canSyncSubscriptionFromStripe({
        status: "pending_setup",
        stripe_subscription_id: null,
      }),
    ).toBe(false);
  });
});
