import assert from "node:assert/strict";
import { mergeMessageIntoList } from "../messagesRealtimeCache";
import type { ConversationMessage } from "@/lbs/types";

const baseMessage = (id: number, body: string): ConversationMessage => ({
  id,
  conversation_id: 1,
  body,
  channel: "internal",
  direction: "outbound",
  created_at: "2026-01-01T00:00:00.000Z",
});

const first = mergeMessageIntoList(undefined, baseMessage(1, "hello"));
assert.equal(first.data.length, 1);
assert.equal(first.total, 1);

const duplicate = mergeMessageIntoList(first, baseMessage(1, "hello"));
assert.equal(duplicate.data.length, 1, "duplicate id must not append");
assert.equal(duplicate.total, 1);

const merged = mergeMessageIntoList(first, {
  ...baseMessage(1, "hello updated"),
  body: "hello updated",
});
assert.equal(merged.data.length, 1);
assert.equal(merged.data[0]?.body, "hello updated", "same id should merge fields");

const appended = mergeMessageIntoList(first, baseMessage(2, "second"));
assert.equal(appended.data.length, 2);
assert.equal(appended.total, 2);

console.log("messagesRealtimeCache tests passed");
