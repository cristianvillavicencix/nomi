import { describe, expect, it } from "vitest";
import {
  getTicketStatusDurationLabel,
  getTicketWaitingDurationLabel,
} from "@/modules/tickets/ticketSlaUtils";

describe("ticket status duration labels", () => {
  it("labels time spent in any status", () => {
    const threeHoursAgo = new Date(
      Date.now() - 3 * 60 * 60 * 1000,
    ).toISOString();
    expect(getTicketStatusDurationLabel("open", threeHoursAgo)).toBe(
      "Open · 3h",
    );
    expect(getTicketStatusDurationLabel("waiting", threeHoursAgo)).toBe(
      "Waiting · 3h",
    );
  });

  it("keeps waiting SLA badge only after 48h", () => {
    const threeHoursAgo = new Date(
      Date.now() - 3 * 60 * 60 * 1000,
    ).toISOString();
    const threeDaysAgo = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(getTicketWaitingDurationLabel("waiting", threeHoursAgo)).toBeNull();
    expect(getTicketWaitingDurationLabel("waiting", threeDaysAgo)).toBe(
      "Waiting 3d",
    );
  });
});
