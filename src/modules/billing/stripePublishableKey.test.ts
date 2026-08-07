import { describe, expect, it } from "vitest";
import {
  readEnvStripePublishableKey,
  resolveStripePublishableKey,
} from "@/modules/billing/stripePublishableKey";

describe("stripePublishableKey", () => {
  it("returns the first non-empty candidate", () => {
    expect(
      resolveStripePublishableKey("", null, "pk_test_abc", "pk_test_def"),
    ).toBe("pk_test_abc");
  });

  it("returns null when no candidates are set", () => {
    expect(resolveStripePublishableKey("", null, undefined)).toBeNull();
  });

  it("reads env publishable key helper without throwing", () => {
    expect(
      readEnvStripePublishableKey() === null ||
        readEnvStripePublishableKey()?.startsWith("pk_"),
    ).toBe(true);
  });
});
