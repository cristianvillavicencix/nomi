import { describe, expect, it } from "vitest";
import { excludeSentOnlyThreads } from "./mailListFilters";
import type { MailThread } from "./types";

function thread(id: number): MailThread {
  return {
    id,
    account_id: 1,
    org_id: 1,
    provider_thread_id: `t-${id}`,
    subject: "Test",
    snippet: null,
    participants: [],
    last_message_at: null,
    is_unread: false,
    is_starred: false,
    is_draft: false,
    is_archived: false,
    is_trashed: false,
    is_spam: false,
    message_count: 1,
  };
}

describe("excludeSentOnlyThreads", () => {
  it("removes sent-only threads from inbox candidates", () => {
    const threads = [thread(1), thread(2), thread(3)];
    const sentOnly = new Set([2]);
    expect(excludeSentOnlyThreads(threads, sentOnly).map((t) => t.id)).toEqual([
      1, 3,
    ]);
  });
});
