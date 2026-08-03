import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { ConversationMessage, VoiceCall } from "@/modules/types";
import {
  buildVoiceCallTimelineLabel,
  mergeClientConversationTimeline,
} from "@/modules/voice/voiceCallTimeline";

const baseCall = (overrides: Partial<VoiceCall>): VoiceCall =>
  ({
    id: 1,
    org_id: 1,
    direction: "outbound",
    status: "completed",
    duration_seconds: 212,
    started_at: "2026-07-23T14:00:00.000Z",
    ended_at: "2026-07-23T14:03:32.000Z",
    created_at: "2026-07-23T14:00:00.000Z",
    ...overrides,
  }) as VoiceCall;

describe("buildVoiceCallTimelineLabel", () => {
  it("formats completed outbound calls with duration", () => {
    assert.equal(
      buildVoiceCallTimelineLabel(baseCall({ direction: "outbound" })),
      "Outgoing call · 3:32",
    );
  });

  it("formats missed inbound calls", () => {
    assert.equal(
      buildVoiceCallTimelineLabel(
        baseCall({
          direction: "inbound",
          status: "no-answer",
          duration_seconds: 0,
        }),
      ),
      "Missed call",
    );
  });

  it("formats outbound no-answer calls", () => {
    assert.equal(
      buildVoiceCallTimelineLabel(
        baseCall({ status: "no-answer", duration_seconds: null }),
      ),
      "Outgoing call · No answer",
    );
  });
});

describe("mergeClientConversationTimeline", () => {
  it("interleaves messages and calls chronologically", () => {
    const messages = [
      {
        id: 1,
        created_at: "2026-07-23T14:01:00.000Z",
        kind: "user",
        body: "Hi",
      },
      {
        id: 2,
        created_at: "2026-07-23T14:10:00.000Z",
        kind: "user",
        body: "Thanks",
      },
    ] as ConversationMessage[];

    const calls = [
      baseCall({
        id: 9,
        ended_at: "2026-07-23T14:05:00.000Z",
      }),
    ];

    const timeline = mergeClientConversationTimeline(messages, calls);
    assert.equal(timeline.length, 3);
    assert.equal(timeline[0]?.kind, "message");
    assert.equal(timeline[1]?.kind, "call");
    assert.equal(timeline[2]?.kind, "message");
  });
});
