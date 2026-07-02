import { describe, expect, it } from "vitest";
import {
  assertSmsBodyWithinLimit,
  estimateSmsSegments,
  SMS_MAX_BODY_CHARS,
} from "@/modules/messages/smsMessageLimits";

describe("smsMessageLimits", () => {
  it("allows bodies at the Twilio limit", () => {
    const body = "a".repeat(SMS_MAX_BODY_CHARS);
    expect(() => assertSmsBodyWithinLimit(body)).not.toThrow();
  });

  it("rejects bodies over the Twilio limit", () => {
    const body = "a".repeat(SMS_MAX_BODY_CHARS + 1);
    expect(() => assertSmsBodyWithinLimit(body)).toThrow(/too long/i);
  });

  it("estimates GSM segments", () => {
    expect(estimateSmsSegments("hello")).toBe(1);
    expect(estimateSmsSegments("a".repeat(161))).toBe(2);
  });

  it("estimates UCS-2 segments for emoji", () => {
    expect(estimateSmsSegments("👋")).toBe(1);
    expect(estimateSmsSegments("👋".repeat(35))).toBe(1);
    expect(estimateSmsSegments("👋".repeat(36))).toBe(2);
  });
});
