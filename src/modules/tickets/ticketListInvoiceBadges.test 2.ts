import { describe, expect, it } from "vitest";
import { getTicketInvoiceBadges } from "@/modules/tickets/ticketListInvoiceBadgeUtils";
import type { ClientInvoice, Ticket } from "@/modules/types";

const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 1,
  subject: "Test ticket",
  status: "resolved",
  priority: "normal",
  ...overrides,
});

const invoice = (overrides: Partial<ClientInvoice> = {}): ClientInvoice => ({
  id: 1,
  invoice_number: "INV-1",
  issue_date: "2026-06-01",
  due_date: "2026-06-15",
  amount: 100,
  description: "Supplement",
  ...overrides,
});

describe("getTicketInvoiceBadges", () => {
  it("returns Paid for a single paid invoice", () => {
    const badges = getTicketInvoiceBadges(ticket(), [
      invoice({ status: "paid" }),
    ]);
    expect(badges.some((badge) => badge.label === "Paid")).toBe(true);
  });

  it("summarizes multiple invoice states", () => {
    const badges = getTicketInvoiceBadges(ticket(), [
      invoice({ id: 1, status: "paid" }),
      invoice({ id: 2, status: "sent", due_date: "2026-12-31" }),
    ]);
    expect(badges.some((badge) => badge.label === "Paid")).toBe(true);
    expect(badges.some((badge) => badge.label === "Awaiting payment")).toBe(
      true,
    );
  });

  it("falls back to awaiting payment when invoice list is missing", () => {
    const badges = getTicketInvoiceBadges(
      ticket({ invoice_id: 9, delivery_status: "invoice_sent" }),
      [],
    );
    expect(badges[0]?.label).toBe("Awaiting payment");
  });
});
