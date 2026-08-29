import { describe, expect, it } from "vitest";
import {
  grossUpSubscriptionLinePrices,
  subscriptionChargeFromNet,
} from "@/modules/billing/subscriptions/subscriptionFeeUtils";

describe("subscriptionChargeFromNet", () => {
  it("grosses up $150 with Stripe 2.9% + $0.30", () => {
    const { subtotal, feeAmount, total } = subscriptionChargeFromNet(150);
    expect(subtotal).toBe(150);
    expect(feeAmount).toBe(4.79);
    expect(total).toBe(154.79);
  });

  it("returns zeros for empty amount", () => {
    expect(subscriptionChargeFromNet(0)).toEqual({
      subtotal: 0,
      feeAmount: 0,
      total: 0,
    });
  });
});

describe("grossUpSubscriptionLinePrices", () => {
  it("scales a single line to the gross charge", () => {
    const [line] = grossUpSubscriptionLinePrices([
      { quantity: 1, unit_price: 150 },
    ]);
    expect(line.unit_price).toBe(154.79);
  });

  it("keeps multi-line totals equal to gross charge", () => {
    const lines = grossUpSubscriptionLinePrices([
      { quantity: 1, unit_price: 100 },
      { quantity: 1, unit_price: 50 },
    ]);
    const sum = lines.reduce(
      (total, line) => total + line.quantity * line.unit_price,
      0,
    );
    expect(sum).toBeCloseTo(154.79, 2);
  });
});
