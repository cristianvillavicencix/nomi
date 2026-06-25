import { describe, expect, it } from "vitest";
import {
  inferCredentialLocation,
  inferCredentialProvider,
} from "@/modules/portal/portalServiceMeta";
import type { PortalCredential } from "@/modules/portal/portalTypes";

const credential = (
  overrides: Partial<PortalCredential> & Pick<PortalCredential, "id" | "label">,
): PortalCredential => ({
  managed_by: "lbs",
  ...overrides,
});

describe("portalServiceMeta", () => {
  it("detects provider and location from credential metadata", () => {
    expect(
      inferCredentialProvider(
        credential({
          id: 1,
          label: "Hostinger panel",
          url: "https://hpanel.hostinger.com",
        }),
      ),
    ).toBe("Hostinger");
    expect(
      inferCredentialLocation(
        credential({
          id: 2,
          label: "WordPress admin",
          url: "https://armando.com/wp-admin",
        }),
      ),
    ).toBe("armando.com");
  });
});
