import { describe, expect, it } from "vitest";
import { ticketAssigneeChanged } from "@/modules/notifications/ticketAssignmentRealtime";

describe("ticketAssigneeChanged", () => {
  it("ignores updates whose old row has no assignee_id", () => {
    expect(
      ticketAssigneeChanged({ assignee_id: 7 }, { id: 12 }),
    ).toBe(false);
  });

  it("detects assignee changes when old row includes assignee_id", () => {
    expect(
      ticketAssigneeChanged({ assignee_id: 7 }, { id: 12, assignee_id: 3 }),
    ).toBe(true);
    expect(
      ticketAssigneeChanged({ assignee_id: 7 }, { id: 12, assignee_id: 7 }),
    ).toBe(false);
    expect(
      ticketAssigneeChanged({ assignee_id: 7 }, { id: 12, assignee_id: null }),
    ).toBe(true);
  });
});
