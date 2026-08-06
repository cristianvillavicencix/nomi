import { describe, expect, it } from "vitest";
import {
  appendRequestScopeToUrl,
  buildPresetServicesAnswers,
  scopeForFullResourceRequest,
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

describe("scopeForFullResourceRequest", () => {
  it("falls back to services list when no tabs exist", () => {
    expect(scopeForFullResourceRequest([])).toEqual({
      sections: ["logo", "team", "services"],
    });
  });

  it("includes logo, team, and per-service photo steps when tabs exist", () => {
    expect(
      scopeForFullResourceRequest([
        {
          id: "service:carpentry",
          label: "Carpentry",
          category: "service:carpentry",
        },
        {
          id: "service:decks",
          label: "Decks",
          category: "service:decks",
        },
      ]),
    ).toEqual({
      sections: ["logo", "team", "service:carpentry", "service:decks"],
      presetServices: ["Carpentry", "Decks"],
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

  it("hides services list when presets exist even if sections includes services", () => {
    expect(
      shouldShowProjectResourcesSection(
        "services",
        ["logo", "team", "services"],
        ["Carpentry", "Decks"],
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

  it("hides before-after for a single service photo scope", () => {
    expect(
      shouldShowProjectResourcesSection("before_after", ["service:framing"]),
    ).toBe(false);
  });

  it("shows before-after for full resource scope with services", () => {
    expect(
      shouldShowProjectResourcesSection("before_after", [
        "logo",
        "team",
        "service:framing",
      ]),
    ).toBe(true);
  });
});

describe("buildPresetServicesAnswers", () => {
  it("returns services array for wizard prefill", () => {
    expect(buildPresetServicesAnswers(["Carpentry", "Framing"])).toEqual({
      services: ["Carpentry", "Framing"],
    });
  });

  it("returns empty object when no presets", () => {
    expect(buildPresetServicesAnswers([])).toEqual({});
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
