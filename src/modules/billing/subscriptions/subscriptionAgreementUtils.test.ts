import { describe, expect, it } from "vitest";
import { shouldAutoActivateAgreementEnrollment } from "@/modules/billing/subscriptions/subscriptionAgreementUtils";

describe("shouldAutoActivateAgreementEnrollment", () => {
  it("activates only signed agreement enrollments still pending setup", () => {
    expect(
      shouldAutoActivateAgreementEnrollment({
        enrollment_mode: "agreement",
        agreement_signed_at: "2026-08-31T12:00:00.000Z",
        stripe_subscription_id: null,
        status: "pending_setup",
      }),
    ).toBe(true);
  });

  it("does not activate direct or request_setup style rows", () => {
    expect(
      shouldAutoActivateAgreementEnrollment({
        enrollment_mode: "direct",
        agreement_signed_at: "2026-08-31T12:00:00.000Z",
        stripe_subscription_id: null,
        status: "pending_setup",
      }),
    ).toBe(false);
    expect(
      shouldAutoActivateAgreementEnrollment({
        enrollment_mode: null,
        agreement_signed_at: null,
        stripe_subscription_id: null,
        status: "pending_setup",
      }),
    ).toBe(false);
  });

  it("does not activate until the agreement is signed", () => {
    expect(
      shouldAutoActivateAgreementEnrollment({
        enrollment_mode: "agreement",
        agreement_signed_at: null,
        stripe_subscription_id: null,
        status: "pending_setup",
      }),
    ).toBe(false);
  });
});
