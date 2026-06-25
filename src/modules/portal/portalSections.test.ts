import { describe, expect, it } from "vitest";
import { normalizePortalEnabledSections } from "@/modules/portal/portalTypes";

describe("normalizePortalEnabledSections", () => {
  it("always includes hosting and credentials tabs", () => {
    expect(
      normalizePortalEnabledSections(["credentials", "handoff", "domain_dns"]),
    ).toEqual([
      "overview",
      "hosting",
      "domain",
      "credentials",
      "billing",
      "files",
      "handoff",
    ]);
  });

  it("expands hosting_domain into hosting and domain tabs", () => {
    expect(
      normalizePortalEnabledSections([
        "overview",
        "hosting_domain",
        "credentials",
      ]),
    ).toEqual([
      "overview",
      "hosting",
      "domain",
      "credentials",
      "billing",
      "files",
      "handoff",
    ]);
  });
});
