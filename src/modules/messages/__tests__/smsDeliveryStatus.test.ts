import { describe, expect, it } from "vitest";
import { getSmsDeliveryDisplay } from "@/modules/messages/smsDeliveryStatus";
import type { ConversationMessage } from "@/modules/types";

const outbound = (
  overrides: Partial<ConversationMessage> = {},
): ConversationMessage => ({
  id: 1,
  conversation_id: 1,
  body: "Hello",
  direction: "outbound",
  external_id: "SM123",
  ...overrides,
});

describe("getSmsDeliveryDisplay", () => {
  it("returns null for inbound messages", () => {
    expect(
      getSmsDeliveryDisplay(
        outbound({ direction: "inbound", external_id: "SM123" }),
      ),
    ).toBeNull();
  });

  it("marks delivered messages as success", () => {
    expect(
      getSmsDeliveryDisplay(
        outbound({ sms_delivery_status: "delivered" }),
      ),
    ).toMatchObject({ label: "Delivered", tone: "success" });
  });

  it("surfaces carrier failures with error hints", () => {
    expect(
      getSmsDeliveryDisplay(
        outbound({
          sms_delivery_status: "undelivered",
          sms_error_code: "30007",
        }),
      ),
    ).toMatchObject({
      label: "Not delivered",
      tone: "error",
      detail: "Blocked by carrier (spam filter)",
    });
  });
});
