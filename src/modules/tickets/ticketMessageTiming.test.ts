import { describe, expect, it } from "vitest";
import type { TicketMessage } from "@/modules/types";
import {
  formatDurationShort,
  getReplyDurationLabel,
} from "@/modules/tickets/ticketInboxUi";

const msg = (
  partial: Partial<TicketMessage> & Pick<TicketMessage, "id" | "direction">,
): TicketMessage => ({
  ticket_id: 1,
  body: "",
  ...partial,
});

describe("ticket message timing", () => {
  it("formats short durations", () => {
    expect(formatDurationShort(30_000)).toBe("< 1m");
    expect(formatDurationShort(90 * 60 * 1000)).toBe("1h 30m");
    expect(formatDurationShort(26 * 60 * 60 * 1000)).toBe("1d 2h");
  });

  it("measures reply time from the latest prior inbound message", () => {
    const messages = [
      msg({
        id: 1,
        direction: "inbound",
        created_at: "2026-08-17T12:00:00.000Z",
      }),
      msg({
        id: 2,
        direction: "outbound",
        created_at: "2026-08-17T14:30:00.000Z",
      }),
    ];

    expect(getReplyDurationLabel(messages[1], messages)).toBe("Replied in 2h 30m");
  });
});
