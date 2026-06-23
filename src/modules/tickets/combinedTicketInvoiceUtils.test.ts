import { describe, expect, it } from "vitest";
import {
  buildCombinedInvoicePropertySummary,
  validateTicketsForCombinedInvoice,
} from "@/modules/tickets/combinedTicketInvoiceUtils";
import type { Ticket } from "@/modules/types";

const baseTicket = (id: number, email: string): Ticket =>
  ({
    id,
    subject: `Property ${id}`,
    requester_email: email,
    company_id: 1,
    contact_id: null,
    status: "open",
    delivery_status: "none",
  }) as Ticket;

describe("combinedTicketInvoiceUtils", () => {
  it("requires the same recipient email", () => {
    const tickets = [
      baseTicket(1, "client@example.com"),
      baseTicket(2, "other@example.com"),
    ];
    expect(
      validateTicketsForCombinedInvoice(tickets, new Map(), new Map()),
    ).toMatch(/same recipient email/i);
  });

  it("builds a property summary across tickets", () => {
    const summary = buildCombinedInvoicePropertySummary([
      baseTicket(2, "client@example.com"),
      baseTicket(1, "client@example.com"),
    ]);
    expect(summary).toBe("Property 1 · Property 2");
  });
});
