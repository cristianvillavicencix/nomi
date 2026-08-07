import { describe, expect, it } from "vitest";
import {
  subscriptionLinesToPayload,
  sumSubscriptionLinesAmount,
} from "@/modules/billing/subscriptions/subscriptionLineUtils";

describe("subscriptionLineUtils", () => {
  it("sums multi-line subscription amounts", () => {
    const total = sumSubscriptionLinesAmount([
      {
        key: "a",
        title: "Google Ads Starter",
        item_detail: "",
        quantity: 1,
        unit: "ea",
        unit_price: 463.05,
        sort_order: 0,
      },
      {
        key: "b",
        title: "Management fee",
        item_detail: "",
        quantity: 1,
        unit: "ea",
        unit_price: 99,
        sort_order: 1,
      },
    ]);

    expect(total).toBeCloseTo(562.05);
    expect(subscriptionLinesToPayload([
      {
        key: "a",
        title: "Google Ads Starter",
        item_detail: "",
        quantity: 1,
        unit: "ea",
        unit_price: 463.05,
        sort_order: 0,
      },
    ])).toEqual([
      {
        description: "Google Ads Starter",
        quantity: 1,
        unit: "ea",
        unit_price: 463.05,
        package_id: null,
        addon_id: null,
        item_detail: null,
      },
    ]);
  });
});
