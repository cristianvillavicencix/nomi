import { describe, expect, it } from "vitest";
import {
  getTicketReplyStatusTransitions,
  normalizeTicketWorkflowStatus,
} from "./ticketReplyStatusActions";

describe("ticketReplyStatusActions", () => {
  it("normalizes unknown statuses to open", () => {
    expect(normalizeTicketWorkflowStatus("bogus")).toBe("open");
  });

  it("waiting primary path keeps waiting — transitions exclude current status", () => {
    const transitions = getTicketReplyStatusTransitions("waiting");
    expect(transitions.map((item) => item.status)).toEqual(["open", "resolved"]);
    expect(transitions.map((item) => item.label)).toEqual([
      "Send & Open",
      "Send & Resolved",
    ]);
  });

  it("open transitions exclude open", () => {
    const transitions = getTicketReplyStatusTransitions("open");
    expect(transitions.map((item) => item.status)).toEqual([
      "waiting",
      "resolved",
    ]);
  });

  it("new offers all workflow transitions", () => {
    const transitions = getTicketReplyStatusTransitions("new");
    expect(transitions.map((item) => item.status)).toEqual([
      "open",
      "waiting",
      "resolved",
    ]);
  });

  it("resolved excludes resolved from transitions", () => {
    const transitions = getTicketReplyStatusTransitions("resolved");
    expect(transitions.map((item) => item.status)).toEqual(["open", "waiting"]);
    expect(transitions.some((item) => item.status === "resolved")).toBe(false);
  });
});
