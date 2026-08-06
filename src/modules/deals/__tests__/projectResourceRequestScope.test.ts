import { describe, expect, it } from "vitest";
import {
  appendRequestScopeToUrl,
  scopeForPhotoServicesRequest,
  scopeForResourceTab,
  shouldShowProjectResourcesSection,
} from "@/modules/deals/projectResourceRequestScope";

describe("scopeForPhotoServicesRequest", () => {
  it("falls back to services list when no tabs exist", () => {
    expect(scopeForPhotoServicesRequest([])).toEqual({
      sections: ["services"],
    });
  });

  it("skips services list and pre-fills all project service tabs", () => {
    const scope = scopeForPhotoServicesRequest([
      {
        id: "service:carpentry",
        label: "Carpentry",
        category: "service:carpentry",
      },
      {
        id: "service:framing",
        label: "Framing",
        category: "service:framing",
      },
    ]);

    expect(scope).toEqual({
      sections: ["service:carpentry", "service:framing"],
      presetServices: ["Carpentry", "Framing"],
    });
  });
});

describe("scopeForResourceTab", () => {
  it("uses project service tabs for Photo services request", () => {
    const scope = scopeForResourceTab("service-photo", {
      serviceTabs: [
        {
          id: "service:roofing",
          label: "Roofing",
          category: "service:roofing",
        },
      ],
    });

    expect(scope).toEqual({
      sections: ["service:roofing"],
      presetServices: ["Roofing"],
    });
  });

  it("uses tab label for a single service sub-tab", () => {
    const scope = scopeForResourceTab("service:kitchen-remodeling", {
      serviceTabs: [
        {
          id: "service:kitchen-remodeling",
          label: "Kitchen Remodeling",
          category: "service:kitchen-remodeling",
        },
      ],
    });

    expect(scope.presetServices).toEqual(["Kitchen Remodeling"]);
  });
});

describe("shouldShowProjectResourcesSection", () => {
  it("hides services list when scoped to service slugs with presets", () => {
    expect(
      shouldShowProjectResourcesSection(
        "services",
        ["service:framing", "service:carpentry"],
        ["Framing", "Carpentry"],
      ),
    ).toBe(false);
  });

  it("shows service photos for service slug scope", () => {
    expect(
      shouldShowProjectResourcesSection("service_photos", [
        "service:framing",
      ]),
    ).toBe(true);
  });

  it("skips company intro for service-photo-only scope", () => {
    expect(
      shouldShowProjectResourcesSection("company_info", ["service:framing"]),
    ).toBe(false);
  });
});

describe("appendRequestScopeToUrl", () => {
  it("encodes preset services in the URL", () => {
    const url = appendRequestScopeToUrl("https://example.com/f/abc", {
      sections: ["service:framing", "service:carpentry"],
      presetServices: ["Framing", "Carpentry"],
    });

    expect(url).toContain("sections=service%3Aframing%2Cservice%3Acarpentry");
    expect(url).toContain("services=Framing%7C+Carpentry");
  });
});
