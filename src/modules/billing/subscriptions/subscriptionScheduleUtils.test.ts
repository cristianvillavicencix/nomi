import { describe, expect, it } from "vitest";
import {
  buildStripeScheduleUnixParams,
  computeSubscriptionEndsAt,
  formatLocalIsoDate,
  parseIsoDateAtStartOfDay,
} from "@/modules/billing/subscriptions/subscriptionScheduleUtils";

describe("subscriptionScheduleUtils", () => {
  it("computes end date from fixed month duration", () => {
    const startsAt = parseIsoDateAtStartOfDay("2026-08-15");
    expect(startsAt).not.toBeNull();
    const endsAt = computeSubscriptionEndsAt({
      startsAt: startsAt!,
      duration: "6",
    });
    expect(endsAt && formatLocalIsoDate(endsAt)).toBe("2027-02-15");
  });

  it("returns null for ongoing subscriptions", () => {
    const startsAt = parseIsoDateAtStartOfDay("2026-08-15");
    expect(
      computeSubscriptionEndsAt({ startsAt: startsAt!, duration: "ongoing" }),
    ).toBeNull();
  });

  it("maps future start to Stripe trial_end", () => {
    const now = new Date("2026-08-01T12:00:00");
    const startsAt = new Date("2026-09-01T00:00:00");
    const params = buildStripeScheduleUnixParams({
      startsAt,
      endsAt: new Date("2027-09-01T23:59:59"),
      now,
    });
    expect(params.trial_end).toBe(Math.floor(startsAt.getTime() / 1000));
    expect(params.cancel_at).toBeTypeOf("number");
  });
});
