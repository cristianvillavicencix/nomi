import { describe, expect, it } from "vitest";
import { resolveNextMaintenanceDate } from "@/modules/portal/portalMaintenanceUtils";
import type { PortalDelivery } from "@/modules/portal/portalTypes";

const delivery = (overrides: Partial<PortalDelivery>): PortalDelivery => ({
  id: 1,
  delivered_at: "2026-01-15T12:00:00Z",
  ...overrides,
});

describe("resolveNextMaintenanceDate", () => {
  it("prefers explicit next_review_date", () => {
    expect(
      resolveNextMaintenanceDate(
        delivery({
          maintenance_plan: {
            free_months: 3,
            next_review_date: "2026-09-01",
          },
        }),
      ),
    ).toBe("2026-09-01");
  });

  it("falls back to delivered_at plus free months", () => {
    expect(
      resolveNextMaintenanceDate(
        delivery({
          delivered_at: "2026-01-15T12:00:00Z",
          maintenance_plan: { free_months: 3 },
        }),
      ),
    ).toBe("2026-04-15");
  });
});
