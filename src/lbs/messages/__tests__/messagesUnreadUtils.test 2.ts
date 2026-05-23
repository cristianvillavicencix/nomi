import assert from "node:assert/strict";
import type { Conversation, ConversationParticipant } from "@/lbs/types";
import {
  computeUnreadConversationCounts,
  getConversationReadAt,
  isConversationUnread,
} from "../messagesUnreadUtils";

const participant = (
  conversationId: number,
  lastReadAt?: string,
): ConversationParticipant => ({
  id: conversationId,
  conversation_id: conversationId,
  member_id: 1,
  last_read_at: lastReadAt,
});

const conversation = (id: number, lastMessageAt: string): Conversation => ({
  id,
  type: "client",
  last_message_at: lastMessageAt,
});

assert.equal(
  getConversationReadAt(1, [participant(1, "2026-01-02T00:00:00.000Z")]),
  "2026-01-02T00:00:00.000Z",
);

assert.equal(
  isConversationUnread(conversation(1, "2026-01-03T00:00:00.000Z"), [
    participant(1, "2026-01-02T00:00:00.000Z"),
  ]),
  true,
);

assert.equal(
  isConversationUnread(conversation(1, "2026-01-01T00:00:00.000Z"), [
    participant(1, "2026-01-02T00:00:00.000Z"),
  ]),
  false,
);

assert.equal(
  isConversationUnread(conversation(1, "2026-01-03T00:00:00.000Z"), []),
  true,
);

assert.equal(
  isConversationUnread(conversation(1, "2026-01-03T00:00:00.000Z"), [], {
    "1": "2026-01-03T00:00:00.000Z",
  }),
  false,
);

assert.equal(
  getConversationReadAt(1, [], { "1": "2026-01-04T00:00:00.000Z" }),
  "2026-01-04T00:00:00.000Z",
);

const counts = computeUnreadConversationCounts(
  [
    conversation(1, "2026-01-03T00:00:00.000Z"),
    conversation(2, "2026-01-01T00:00:00.000Z"),
  ],
  [
    participant(1, "2026-01-02T00:00:00.000Z"),
    participant(2, "2026-01-02T00:00:00.000Z"),
  ],
);
assert.equal(counts.totalUnread, 1);
assert.equal(counts.unreadByConversationId["1"], true);

console.log("messagesUnreadUtils tests passed");
