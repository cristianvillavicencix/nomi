import { afterEach, describe, expect, it } from "vitest";
import {
  startVoiceCallRingtone,
  stopVoiceCallRingtone,
} from "@/modules/voice/voiceCallRingtone";

describe("voiceCallRingtone", () => {
  afterEach(() => {
    stopVoiceCallRingtone();
  });

  it("starts and stops without throwing when AudioContext is available", async () => {
    await expect(startVoiceCallRingtone("incoming")).resolves.toBeUndefined();
    expect(() => stopVoiceCallRingtone()).not.toThrow();
  });

  it("switches from incoming to outbound ringback", async () => {
    await startVoiceCallRingtone("incoming");
    await expect(startVoiceCallRingtone("outbound")).resolves.toBeUndefined();
    stopVoiceCallRingtone();
  });
});
