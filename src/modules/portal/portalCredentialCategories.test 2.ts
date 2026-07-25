import { describe, expect, it } from "vitest";
import {
  groupPortalCredentials,
  resolvePortalCredentialCategory,
} from "@/modules/portal/portalCredentialCategories";
import type { PortalCredential } from "@/modules/portal/portalTypes";

const credential = (
  overrides: Partial<PortalCredential> & Pick<PortalCredential, "id" | "label">,
): PortalCredential => ({
  managed_by: "lbs",
  ...overrides,
});

describe("resolvePortalCredentialCategory", () => {
  it("classifies hosting and wordpress labels", () => {
    expect(
      resolvePortalCredentialCategory(
        credential({ id: 1, label: "Hostinger panel" }),
      ),
    ).toBe("hosting");
    expect(
      resolvePortalCredentialCategory(
        credential({ id: 2, label: "WordPress admin" }),
      ),
    ).toBe("website");
  });

  it("respects service_kind when present", () => {
    expect(
      resolvePortalCredentialCategory(
        credential({ id: 3, label: "Custom", service_kind: "email" }),
      ),
    ).toBe("email");
  });
});

describe("groupPortalCredentials", () => {
  it("groups credentials in category order", () => {
    const groups = groupPortalCredentials([
      credential({ id: 1, label: "WordPress admin" }),
      credential({ id: 2, label: "Hostinger" }),
      credential({ id: 3, label: "GoDaddy domain" }),
    ]);

    expect(groups.map((group) => group.category)).toEqual([
      "hosting",
      "website",
      "domain",
    ]);
  });
});
