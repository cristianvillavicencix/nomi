import { describe, expect, it } from "vitest";
import {
  extractTwilioVoiceErrorCode,
  formatVoiceDeviceError,
  isTransientVoiceDeviceError,
} from "@/modules/voice/voiceDeviceErrors";

describe("voiceDeviceErrors", () => {
  it("extracts Twilio error codes from messages", () => {
    expect(
      extractTwilioVoiceErrorCode({
        message: "ConnectionError (31005): A connection error occurred",
      }),
    ).toBe(31005);
  });

  it("maps 31005 to a friendly message", () => {
    expect(
      formatVoiceDeviceError({
        message: "ConnectionError (31005): A connection error occurred",
      }),
    ).toBe(
      "Call connection lost. Check your internet connection and try again.",
    );
  });

  it("treats 31005 as transient when idle", () => {
    expect(
      isTransientVoiceDeviceError({
        code: 31005,
      }),
    ).toBe(true);
  });
});
