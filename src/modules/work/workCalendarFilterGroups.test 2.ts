import { describe, expect, it } from "vitest";
import { ALL_WORK_CATEGORIES } from "@/modules/work/useWorkPreferences";
import {
  getFilterGroupCount,
  isOnlyFilterGroupSelected,
  resolveFilterGroupSelection,
} from "@/modules/work/workCalendarFilterGroups";
import { getWorkCalendarFilterGroup } from "@/modules/work/workCalendarFilterGroups";

describe("workCalendarFilterGroups", () => {
  it("selects scheduled group as activity + follow_up", () => {
    const scheduled = getWorkCalendarFilterGroup("scheduled");
    const next = resolveFilterGroupSelection(ALL_WORK_CATEGORIES, "scheduled");

    expect(next).toEqual(["activity", "follow_up"]);
    expect(isOnlyFilterGroupSelected(next, scheduled)).toBe(true);
  });

  it("returns to all when clicking the only active filter group again", () => {
    const next = resolveFilterGroupSelection(["activity", "follow_up"], "scheduled");
    expect(next).toEqual(ALL_WORK_CATEGORIES);
  });

  it("sums counts for grouped categories", () => {
    const scheduled = getWorkCalendarFilterGroup("scheduled");
    expect(
      getFilterGroupCount({ activity: 57, follow_up: 12, task: 1 }, scheduled),
    ).toBe(69);
  });
});
