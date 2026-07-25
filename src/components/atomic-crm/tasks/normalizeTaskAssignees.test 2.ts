import { describe, expect, it } from "vitest";
import { syncTaskOwnerFromAssignees } from "@/components/atomic-crm/tasks/normalizeTaskAssignees";

describe("normalizeTaskAssignees", () => {
  it("syncs organization_member_id from first assignee", () => {
    const result = syncTaskOwnerFromAssignees({
      assignee_person_ids: [10, 11],
      collaborator_person_ids: [11, 12],
      organization_member_id: 99,
    });

    expect(result.assignee_person_ids).toEqual([10, 11]);
    expect(result.collaborator_person_ids).toEqual([12]);
    expect(result.organization_member_id).toBe(10);
  });

  it("falls back to legacy owner when assignees are empty", () => {
    const result = syncTaskOwnerFromAssignees({
      assignee_person_ids: [],
      organization_member_id: 42,
    });

    expect(result.assignee_person_ids).toEqual([42]);
    expect(result.organization_member_id).toBe(42);
  });
});
