import { describe, expect, it } from "vitest";
import {
  buildTaskMemberMentionToken,
  buildTaskPersonMentionToken,
  extractMentionMemberIds,
  extractMentionPersonIds,
  getMentionQueryAtCursor,
  insertTaskMemberMention,
  insertTaskPersonMention,
  migrateLegacyTaskRecord,
  parseTaskMentionSegments,
} from "./taskMentions";

describe("taskMentions", () => {
  it("builds and extracts person mention tokens", () => {
    const token = buildTaskPersonMentionToken({
      id: 42,
      first_name: "Cristina",
      last_name: "Villavicencio",
    });
    expect(token).toBe("@[Cristina Villavicencio](person:42)");
    expect(extractMentionPersonIds(`${token} follow up`)).toEqual([42]);
  });

  it("builds and extracts member mention tokens", () => {
    const token = buildTaskMemberMentionToken({
      id: 5,
      first_name: "Nestor",
      last_name: "Admin",
    });
    expect(token).toBe("@[Nestor Admin](member:5)");
    expect(extractMentionMemberIds(`${token} review`)).toEqual([5]);
  });

  it("detects an active mention query at the cursor", () => {
    const text = "Please @cris";
    const cursor = text.length;
    expect(getMentionQueryAtCursor(text, cursor)).toEqual({
      start: 7,
      query: "cris",
    });
  });

  it("inserts person and member mention tokens", () => {
    const text = "Please @cris";
    const personResult = insertTaskPersonMention(text, text.length, 7, {
      id: 5,
      first_name: "Cristina",
      last_name: "Lopez",
    });
    expect(personResult.text).toContain("@[Cristina Lopez](person:5)");

    const memberResult = insertTaskMemberMention(text, text.length, 7, {
      id: 9,
      first_name: "Nestor",
      last_name: "Admin",
    });
    expect(memberResult.text).toContain("@[Nestor Admin](member:9)");
  });

  it("parses mixed mention segments for display", () => {
    const text =
      "@[Cristina Villavicencio](person:42) sends invoice and @[Nestor Admin](member:7) reviews";
    expect(parseTaskMentionSegments(text)).toEqual([
      { type: "person", name: "Cristina Villavicencio", id: "42" },
      { type: "text", value: " sends invoice and " },
      { type: "member", name: "Nestor Admin", id: "7" },
      { type: "text", value: " reviews" },
    ]);
  });

  it("migrates legacy task assignments into description mentions", () => {
    const migrated = migrateLegacyTaskRecord(
      {
        id: 1,
        contact_id: 10,
        type: "call",
        text: "Follow up with client",
        due_date: "2026-05-21",
        assignee_person_ids: [42],
        organization_member_id: 5,
      },
      {
        "42": {
          id: 42,
          org_id: 1,
          type: "employee",
          first_name: "Cristina",
          last_name: "Villavicencio",
          status: "active",
          pay_type: "salary",
        },
      },
    );

    expect(migrated.text).toContain("@[Cristina Villavicencio](person:42)");
    expect(migrated.text).toContain("Follow up with client");
  });
});
