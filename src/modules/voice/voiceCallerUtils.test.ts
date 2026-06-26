import { describe, expect, it } from "vitest";
import {
  formatCallerPhoneLabel,
  resolveIncomingCallerPhone,
} from "@/modules/voice/voiceCallerUtils";

describe("voiceCallerUtils", () => {
  it("reads inbound caller from From, not the client identity in To", () => {
    expect(
      resolveIncomingCallerPhone({
        From: "+15551234567",
        To: "client:member-1-2",
      }),
    ).toBe("+15551234567");
  });

  it("ignores client identities", () => {
    expect(
      resolveIncomingCallerPhone({
        From: "client:member-1-2",
        To: "client:member-1-2",
      }),
    ).toBeNull();
  });

  it("formats a readable label for inbound calls", () => {
    expect(
      formatCallerPhoneLabel({
        From: "+15551234567",
        To: "client:member-1-2",
      }),
    ).toBe("(555) 123-4567");
  });
});
