import { describe, expect, it } from "vitest";
import {
  formatTaskDueDateLabel,
  hasTaskDueDateChanged,
  normalizeTaskDueDateKey,
} from "@/components/atomic-crm/tasks/taskDueDateUtils";
import { getTaskNotificationMemberIds } from "@/components/atomic-crm/tasks/taskDueDateNotifications";

describe("taskDueDateUtils", () => {
  it("detects due date changes across formats", () => {
    expect(
      hasTaskDueDateChanged(
        { due_date: "2026-07-21T00:00:00.000Z" },
        { due_date: "2026-07-22T00:00:00.000Z" },
      ),
    ).toBe(true);
    expect(
      hasTaskDueDateChanged(
        { due_date: "2026-07-21T00:00:00.000Z" },
        { due_date: "2026-07-21" },
      ),
    ).toBe(false);
  });

  it("normalizes due dates to date keys", () => {
    expect(normalizeTaskDueDateKey("2026-07-21T15:00:00.000Z")).toMatch(
      /^2026-07-2/,
    );
  });

  it("formats due date labels", () => {
    expect(formatTaskDueDateLabel("2026-07-21")).toContain("2026");
  });
});

describe("getTaskNotificationMemberIds", () => {
  it("includes assignees, collaborators, and owner", () => {
    const ids = getTaskNotificationMemberIds({
      organization_member_id: 1,
      assignee_person_ids: [2, 3],
      collaborator_person_ids: [3, 4],
      text: "Follow up",
    });

    expect(ids.sort()).toEqual([1, 2, 3, 4]);
  });
});
