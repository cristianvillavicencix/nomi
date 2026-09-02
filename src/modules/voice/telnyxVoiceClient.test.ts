import { describe, expect, it } from "vitest";
import { mapTelnyxCallState } from "@/modules/voice/telnyxVoiceClient";

describe("mapTelnyxCallState", () => {
  it("maps Telnyx states onto VoiceCallState", () => {
    expect(mapTelnyxCallState("ringing")).toBe("ringing");
    expect(mapTelnyxCallState("active")).toBe("open");
    expect(mapTelnyxCallState("held")).toBe("open");
    expect(mapTelnyxCallState("trying")).toBe("connecting");
    expect(mapTelnyxCallState("early")).toBe("ringing");
    expect(mapTelnyxCallState("answering")).toBe("connecting");
    expect(mapTelnyxCallState("hangup")).toBe("ended");
    expect(mapTelnyxCallState("destroy")).toBe("ended");
    expect(mapTelnyxCallState("unknown")).toBeNull();
  });
});
