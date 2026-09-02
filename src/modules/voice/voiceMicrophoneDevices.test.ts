import { describe, expect, it } from "vitest";
import { resolvePreferredMicrophoneId } from "@/modules/voice/voiceMicrophoneDevices";

describe("resolvePreferredMicrophoneId", () => {
  const devices = [
    { deviceId: "mic-a", label: "Built-in" },
    { deviceId: "mic-b", label: "Headset" },
  ];

  it("returns preferred id when still available", () => {
    expect(resolvePreferredMicrophoneId(devices, "mic-b")).toBe("mic-b");
  });

  it("falls back to first device when preferred is missing", () => {
    expect(resolvePreferredMicrophoneId(devices, "gone")).toBe("mic-a");
  });

  it("returns null when there are no devices", () => {
    expect(resolvePreferredMicrophoneId([], "mic-a")).toBeNull();
  });
});
