import assert from "node:assert/strict";
import { mergeMessageIntoList } from "../messagesRealtimeCache";
import type { ConversationMessage } from "@/lbs/types";

const baseMessage = (
  id: number,
  body: string,
  createdAt = "2026-01-01T00:00:00.000Z",
): ConversationMessage => ({
  id,
  conversation_id: 1,
  body,
  channel: "internal",
  direction: "outbound",
  created_at: createdAt,
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
assert.equal(
  merged.data[0]?.body,
  "hello updated",
  "same id should merge fields",
);

const appended = mergeMessageIntoList(first, baseMessage(2, "second"));
assert.equal(appended.data.length, 2);
assert.equal(appended.total, 2);
assert.equal(
  appended.data[0]?.id,
  2,
  "DESC cache prepends newest message first",
);
assert.equal(appended.data[1]?.id, 1);

const descExisting = {
  data: [
    baseMessage(3, "msg3", "2026-05-23T12:00:00.000Z"),
    baseMessage(2, "msg2", "2026-05-23T11:00:00.000Z"),
    baseMessage(1, "msg1", "2026-05-23T10:00:00.000Z"),
  ],
  total: 3,
};

const descPrepended = mergeMessageIntoList(
  descExisting,
  baseMessage(4, "msg4", "2026-05-23T13:00:00.000Z"),
);
assert.equal(descPrepended.data[0]?.id, 4, "prepends new message at start");
assert.equal(descPrepended.total, 4);

const deduped = mergeMessageIntoList(
  { data: [baseMessage(1, "old")], total: 1 },
  baseMessage(1, "updated"),
);
assert.equal(deduped.data.length, 1);
assert.equal(deduped.data[0]?.body, "updated");
assert.equal(deduped.total, 1);

console.warn("messagesRealtimeCache tests passed");
