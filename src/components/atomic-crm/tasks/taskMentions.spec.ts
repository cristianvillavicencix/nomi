import { describe, expect, it } from "vitest";
import {
  buildTaskMemberMentionToken,
  extractMentionMemberIds,
  getMentionQueryAtCursor,
  insertTaskMemberMention,
  migrateLegacyTaskRecord,
  parseTaskMentionSegments,
} from "./taskMentions";

describe("taskMentions", () => {
  it("builds and extracts member mention tokens", () => {
    const token = buildTaskMemberMentionToken({
      id: 42,
      first_name: "Cristina",
      last_name: "Villavicencio",
      email: "cristina@example.com",
    });
    expect(token).toBe("@[Cristina Villavicencio](member:42)");
    expect(extractMentionMemberIds(`${token} follow up`)).toEqual([42]);
  });

  it("extracts legacy person mention tokens as member ids", () => {
    expect(
      extractMentionMemberIds("@[Legacy User](person:7) follow up"),
    ).toEqual([7]);
  });

  it("detects an active mention query at the cursor", () => {
    const text = "Please @cris";
    const cursor = text.length;
    expect(getMentionQueryAtCursor(text, cursor)).toEqual({
      start: 7,
      query: "cris",
    });
  });

  it("inserts member mention tokens", () => {
    const text = "Please @cris";
    const memberResult = insertTaskMemberMention(text, text.length, 7, {
      id: 9,
      first_name: "Nestor",
      last_name: "Admin",
      email: "nestor@example.com",
    });
    expect(memberResult.text).toContain("@[Nestor Admin](member:9)");
  });

  it("parses mixed mention segments for display", () => {
    const text =
      "@[Cristina Villavicencio](person:42) sends invoice and @[Nestor Admin](member:7) reviews";
    expect(parseTaskMentionSegments(text)).toEqual([
      { type: "member", name: "Cristina Villavicencio", id: "42" },
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
          first_name: "Cristina",
          last_name: "Villavicencio",
          email: "cristina@example.com",
          administrator: false,
          user_id: "user-42",
        },
      },
    );

    expect(migrated.text).toContain("@[Cristina Villavicencio](member:42)");
    expect(migrated.text).toContain("Follow up with client");
  });
});
