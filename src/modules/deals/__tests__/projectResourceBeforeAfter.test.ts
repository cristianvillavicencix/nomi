import { describe, expect, it } from "vitest";
import {
  buildBeforeAfterCategory,
  getProjectResourceCategoryLabel,
  getResourceTabCategory,
  parseBeforeAfterCategorySlug,
} from "@/modules/deals/projectResourceConstants";
import {
  buildBeforeAfterSubTabs,
  buildServiceSubTabs,
  getResourcesForBeforeAfterSubTab,
  getResourcesForMainTab,
} from "@/modules/deals/projectResourceTabs";
import type { DealResource } from "@/modules/types";

const resource = (
  category: string,
  id = 1,
): DealResource =>
  ({
    id,
    category,
    label: null,
    file: { title: "photo.jpg", type: "image/jpeg", path: "x", src: "x" },
  }) as DealResource;

describe("before-after categories", () => {
  it("maps before-after storage to the before-after tab", () => {
    expect(getResourceTabCategory("before-after:kitchen-remodeling")).toBe(
      "before-after",
    );
    expect(parseBeforeAfterCategorySlug("before-after:kitchen-remodeling")).toBe(
      "kitchen-remodeling",
    );
  });

  it("builds readable labels", () => {
    expect(getProjectResourceCategoryLabel("before-after:carpentry")).toBe(
      "Before & After · Carpentry",
    );
  });

  it("mirrors service tabs for before-after sub-tabs", () => {
    const serviceTabs = buildServiceSubTabs(
      [resource("service:carpentry"), resource("service:decks", 2)],
      [],
    );
    const beforeAfterTabs = buildBeforeAfterSubTabs(serviceTabs);

    expect(beforeAfterTabs).toHaveLength(2);
    expect(beforeAfterTabs[0].category).toBe(
      buildBeforeAfterCategory("carpentry"),
    );
  });

  it("filters resources per before-after service tab", () => {
    const serviceTabs = buildServiceSubTabs([resource("service:carpentry")], []);
    const beforeAfterTab = buildBeforeAfterSubTabs(serviceTabs)[0];
    const items = [
      resource("before-after:carpentry"),
      resource("before-after:decks", 2),
      resource("service:carpentry", 3),
    ];

    expect(getResourcesForMainTab("before-after", items)).toHaveLength(2);
    expect(getResourcesForBeforeAfterSubTab(beforeAfterTab, items)).toHaveLength(
      1,
    );
  });
});
