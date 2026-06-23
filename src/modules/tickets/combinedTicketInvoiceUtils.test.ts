import { describe, expect, it } from "vitest";
import {
  buildCombinedInvoicePropertySummary,
  getCombinedRecipientEmailOptions,
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
  it("allows different recipient emails when options are available", () => {
    const tickets = [
      baseTicket(1, "client@example.com"),
      baseTicket(2, "other@example.com"),
    ];
    const options = getCombinedRecipientEmailOptions(
      tickets,
      new Map(),
      new Map(),
    );
    expect(options).toHaveLength(2);
    expect(
      validateTicketsForCombinedInvoice(tickets, new Map(), new Map()),
    ).toBeNull();
  });

  it("builds a property summary across tickets", () => {
    const summary = buildCombinedInvoicePropertySummary([
      baseTicket(2, "client@example.com"),
      baseTicket(1, "client@example.com"),
    ]);
    expect(summary).toBe("Property 1 · Property 2");
  });
});
