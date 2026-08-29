import { describe, expect, it } from "vitest";
import type { Ticket } from "@/modules/types";
import {
  getTicketServiceTypeLabels,
  normalizeTicketServiceTypes,
  resolveTicketKanbanRibbon,
  toggleTicketServiceType,
} from "./ticketKanbanCardMeta";

const ticket = (partial: Partial<Ticket>): Ticket =>
  ({
    id: 1,
    subject: "Job",
    status: "open",
    priority: "normal",
    ...partial,
  }) as Ticket;

describe("resolveTicketKanbanRibbon", () => {
  it("maps paid to a Paid ribbon", () => {
    expect(resolveTicketKanbanRibbon({ key: "paid", label: "Paid" })).toEqual(
      expect.objectContaining({ label: "Paid", key: "paid" }),
    );
  });

  it("shortens awaiting payment labels", () => {
    expect(
      resolveTicketKanbanRibbon({
        key: "pending",
        label: "Awaiting payment",
      })?.label,
    ).toBe("Awaiting");
  });

  it("skips draft badges", () => {
    expect(
      resolveTicketKanbanRibbon({ key: "draft", label: "Draft" }),
    ).toBeNull();
  });
});

describe("ticket service types", () => {
  it("reads classification from service_types only", () => {
    expect(
      getTicketServiceTypeLabels(
        ticket({
          service_types: ["xactimate", "roof"],
          billing_has_siding: true,
          subject: "Asbestos job",
        }),
      ),
    ).toEqual(["Xactimate", "Roof"]);
  });

  it("ignores billing and subject when unset", () => {
    expect(
      getTicketServiceTypeLabels(
        ticket({
          billing_has_roof: true,
          subject: "Siding measurement",
        }),
      ),
    ).toEqual([]);
  });

  it("normalizes and toggles ids", () => {
    expect(normalizeTicketServiceTypes(["Roof", "xactimate", "nope"])).toEqual([
      "roof",
      "xactimate",
    ]);
    expect(toggleTicketServiceType(["roof"], "siding")).toEqual([
      "roof",
      "siding",
    ]);
    expect(toggleTicketServiceType(["roof", "siding"], "roof")).toEqual([
      "siding",
    ]);
  });
});
