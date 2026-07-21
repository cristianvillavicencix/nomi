import { describe, expect, it } from "vitest";
import type { Company, Ticket } from "@/components/atomic-crm/types";
import type { Ticket as TicketRecord } from "@/modules/types";
import {
  resolveTicketPrimaryContactName,
  ticketNamesOverlapAsSameEntity,
} from "./ticketListMeta";

describe("ticketListMeta identity", () => {
  it("treats requester and company names as duplicates when similar", () => {
    expect(
      ticketNamesOverlapAsSameEntity(
        "Gonzalez Roofing",
        "Gonzalez Roofing LLC",
      ),
    ).toBe(true);
  });

  it("prefers primary contact name over email From line", () => {
    const ticket = {
      id: 90,
      requester_name: "Gonzalez Roofing",
    } as TicketRecord;
    const company = {
      id: 1,
      name: "Gonzalez Roofing LLC",
      primary_contact_first_name: "Jose",
      primary_contact_last_name: "Gonzalez",
    } as Company;

    expect(resolveTicketPrimaryContactName(ticket, company, null)).toBe(
      "Jose Gonzalez",
    );
  });

  it("hides requester when it repeats the company name", () => {
    const ticket = {
      id: 90,
      requester_name: "Gonzalez Roofing",
    } as TicketRecord;
    const company = {
      id: 1,
      name: "Gonzalez Roofing LLC",
    } as Company;

    expect(resolveTicketPrimaryContactName(ticket, company, null)).toBeNull();
  });
});
