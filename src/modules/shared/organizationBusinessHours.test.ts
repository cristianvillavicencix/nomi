import { describe, expect, it } from "vitest";
import {
  formatBusinessHoursSummary,
  hasConfiguredBusinessHours,
  isCommunicationsDayOpen,
} from "@/modules/shared/organizationBusinessHours";

describe("organizationBusinessHours", () => {
  it("detects configured Communications hours", () => {
    expect(hasConfiguredBusinessHours(null)).toBe(false);
    expect(hasConfiguredBusinessHours({})).toBe(false);
    expect(
      hasConfiguredBusinessHours({
        monday: { open: "09:00", close: "17:00" },
      }),
    ).toBe(true);
  });

  it("formats a readable summary", () => {
    const summary = formatBusinessHoursSummary({
      monday: { open: "08:00", close: "16:30" },
      sunday: { closed: true },
    });

    expect(summary).toContain("Mon 08:00–16:30");
    expect(summary).toContain("Sun closed");
  });

  it("treats closed days as not open", () => {
    expect(
      isCommunicationsDayOpen({ sunday: { closed: true } }, "sunday"),
    ).toBe(false);
    expect(
      isCommunicationsDayOpen(
        { saturday: { open: "09:00", close: "14:00" } },
        "saturday",
      ),
    ).toBe(true);
  });
});
