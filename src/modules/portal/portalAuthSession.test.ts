import { describe, expect, it } from "vitest";
import {
  isPortalAuthSessionActive,
  PORTAL_IDLE_MS,
  type StoredPortalAuthSession,
} from "@/modules/portal/portalAuthSession";

const session = (
  overrides: Partial<StoredPortalAuthSession> = {},
): StoredPortalAuthSession => ({
  sensitive_session: "abc",
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  last_activity_at: Date.now(),
  ...overrides,
});

describe("portalAuthSession", () => {
  it("expires after idle timeout", () => {
    const now = Date.now();
    expect(
      isPortalAuthSessionActive(
        session({ last_activity_at: now - PORTAL_IDLE_MS - 1 }),
        now,
      ),
    ).toBe(false);
  });

  it("stays active with recent activity", () => {
    const now = Date.now();
    expect(
      isPortalAuthSessionActive(
        session({ last_activity_at: now - 60_000 }),
        now,
      ),
    ).toBe(true);
  });
});
