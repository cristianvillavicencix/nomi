import { describe, expect, it } from "vitest";
import {
  collectContactRequesterEmails,
  countClientHubTickets,
  filterClientHubTickets,
  mergeScopedTickets,
} from "@/modules/tickets/clientTicketScope";
import type { Ticket } from "@/modules/types";

const ticket = (partial: Partial<Ticket> & { id: number }): Ticket =>
  ({
    id: partial.id,
    subject: partial.subject ?? `Ticket ${partial.id}`,
    status: partial.status ?? "open",
    requester_email: partial.requester_email ?? null,
    company_id: partial.company_id ?? null,
    contact_id: partial.contact_id ?? null,
    merged_into_ticket_id: partial.merged_into_ticket_id ?? null,
    updated_at: partial.updated_at ?? "2026-01-01T00:00:00.000Z",
  }) as Ticket;

describe("clientTicketScope", () => {
  it("collects normalized contact emails", () => {
    const emails = collectContactRequesterEmails([
      {
        id: 1,
        email_jsonb: [{ email: "Leo@Contractor.com" }],
      } as never,
    ]);

    expect(emails).toEqual(["leo@contractor.com"]);
  });

  it("merges company tickets with unlinked email matches", () => {
    const merged = mergeScopedTickets(
      [ticket({ id: 1, company_id: 10 })],
      [
        ticket({
          id: 2,
          company_id: null,
          requester_email: "leo@contractor.com",
        }),
        ticket({
          id: 3,
          company_id: 99,
          requester_email: "leo@contractor.com",
        }),
      ],
      {
        scope: "company",
        companyId: 10,
        requesterEmails: ["leo@contractor.com"],
      },
    );

    expect(merged.map((row) => row.id)).toEqual([1, 2]);
  });

  it("counts and filters hub tickets including resolved", () => {
    const tickets = [
      ticket({ id: 1, status: "open" }),
      ticket({ id: 2, status: "waiting" }),
      ticket({ id: 3, status: "resolved" }),
    ];

    expect(countClientHubTickets(tickets)).toEqual({
      all: 3,
      new: 0,
      open: 1,
      waiting: 1,
      resolved: 1,
    });
    expect(filterClientHubTickets(tickets, "open")).toHaveLength(1);
    expect(filterClientHubTickets(tickets, "all")).toHaveLength(3);
  });
});
