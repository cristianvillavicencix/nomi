import { describe, expect, it } from "vitest";

import {
  buildTicketInboxStatusFilter,
  isTicketStatusFilterId,
  parseTicketInboxStatusFilterFromValues,
  resolveTicketInboxStatusFilter,
  ticketShowPath,
} from "./ticketStatusWorkflow";

describe("ticket inbox status filter", () => {
  it("parses active queue filter as all", () => {
    expect(
      parseTicketInboxStatusFilterFromValues(buildTicketInboxStatusFilter("all")),
    ).toBe("all");
  });

  it("parses exact status filters", () => {
    expect(
      parseTicketInboxStatusFilterFromValues(
        buildTicketInboxStatusFilter("open"),
      ),
    ).toBe("open");
  });

  it("validates status filter ids", () => {
    expect(isTicketStatusFilterId("open")).toBe(true);
    expect(isTicketStatusFilterId("bogus")).toBe(false);
  });

  it("resolves status from ticket when url is missing", () => {
    expect(resolveTicketInboxStatusFilter(null, "open")).toBe("open");
    expect(resolveTicketInboxStatusFilter("waiting", "open")).toBe("waiting");
    expect(resolveTicketInboxStatusFilter(null, null)).toBe("all");
  });

  it("builds ticket show paths with optional status", () => {
    expect(ticketShowPath(12)).toBe("/tickets/12/show");
    expect(ticketShowPath(12, "open")).toBe("/tickets/12/show?status=open");
    expect(ticketShowPath(12, "all")).toBe("/tickets/12/show");
  });
});
