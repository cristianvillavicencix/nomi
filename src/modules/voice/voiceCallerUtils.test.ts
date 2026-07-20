import { describe, expect, it } from "vitest";
import {
  formatCallerPhoneLabel,
  isPhoneOnlyConversationTitle,
  resolveIncomingCallerPhone,
  resolveSmsThreadDisplayName,
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

  it("treats E.164 and formatted phones as phone-only titles", () => {
    expect(
      isPhoneOnlyConversationTitle(
        "+14752570243",
        "+14752570243",
        "(475) 257-0243",
      ),
    ).toBe(true);
    expect(
      isPhoneOnlyConversationTitle(
        "(475) 257-0243",
        "+14752570243",
        "(475) 257-0243",
      ),
    ).toBe(true);
  });

  it("keeps human SMS thread titles", () => {
    expect(
      resolveSmsThreadDisplayName(
        "Cristian_villavicencio",
        "+14752570243",
        "(475) 257-0243",
      ),
    ).toBe("Cristian_villavicencio");
  });
});
