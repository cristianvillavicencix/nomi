import { describe, expect, it } from "vitest";
import {
  resolveInvoiceRecipientPhone,
  resolveTicketInvoiceRecipientPhone,
} from "@/modules/billing/billingUtils";
import type { Company, Contact } from "@/components/atomic-crm/types";

describe("invoice recipient phone", () => {
  it("prefers company invoice phone for standalone invoices", () => {
    const company = {
      id: 1,
      name: "Acme",
      context_links: ["lbs:invoice_phone=2035546470"],
      primary_contact_phone_jsonb: [{ number: "2039999999" }],
    } as Company;

    const contact = {
      id: 2,
      phone_jsonb: [{ number: "2036141494" }],
    } as Contact;

    expect(resolveInvoiceRecipientPhone({ company, contact })).toBe(
      "2035546470",
    );
  });

  it("prefers linked contact phone for ticket invoices", () => {
    const company = {
      id: 1,
      name: "Acme",
      context_links: ["lbs:invoice_phone=2035546470"],
      primary_contact_phone_jsonb: [{ number: "2039999999" }],
    } as Company;

    const contact = {
      id: 2,
      phone_jsonb: [{ number: "2036141494" }],
    } as Contact;

    expect(resolveTicketInvoiceRecipientPhone({ company, contact })).toBe(
      "2036141494",
    );
  });
});
