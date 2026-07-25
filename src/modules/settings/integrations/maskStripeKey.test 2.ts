import { describe, expect, it } from "vitest";

import { maskStripeKey } from "@/modules/settings/integrations/maskStripeKey";

describe("maskStripeKey", () => {
  it("masks long Stripe keys", () => {
    expect(maskStripeKey("pk_live_1234567890abcdef")).toBe(
      "pk_live_…cdef",
    );
  });

  it("returns null for empty values", () => {
    expect(maskStripeKey(null)).toBeNull();
    expect(maskStripeKey("  ")).toBeNull();
  });
});
