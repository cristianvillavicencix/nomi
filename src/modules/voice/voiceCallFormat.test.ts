import { describe, expect, it } from "vitest";
import { formatLiveCallTimer } from "@/modules/voice/voiceCallFormat";

describe("formatLiveCallTimer", () => {
  it("formats under one hour as MM:SS", () => {
    expect(formatLiveCallTimer(0)).toBe("00:00");
    expect(formatLiveCallTimer(40_000)).toBe("00:40");
    expect(formatLiveCallTimer(65_000)).toBe("01:05");
  });

  it("formats over one hour as H:MM:SS", () => {
    expect(formatLiveCallTimer(3_661_000)).toBe("1:01:01");
  });
});
