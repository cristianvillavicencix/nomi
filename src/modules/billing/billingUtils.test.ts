import { describe, expect, it } from "vitest";
import {
  resolveInvoiceRecipientPhone,
  resolveTicketInvoiceRecipientPhone,
  parseInvoiceEmailList,
  getInvalidInvoiceEmails,
  parseInvoicePhoneList,
  getInvalidInvoicePhones,
  formatInvoicePhoneListInput,
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

describe("invoice send recipient lists", () => {
  it("parses comma-separated emails", () => {
    expect(
      parseInvoiceEmailList("a@example.com, B@Example.COM ; invalid"),
    ).toEqual(["a@example.com", "b@example.com"]);
    expect(getInvalidInvoiceEmails("a@example.com, not-an-email")).toEqual([
      "not-an-email",
    ]);
  });

  it("parses and formats comma-separated US phones", () => {
    expect(parseInvoicePhoneList("2035550100, (203) 555-0101")).toEqual([
      "+12035550100",
      "+12035550101",
    ]);
    expect(getInvalidInvoicePhones("2035550100, 123")).toEqual(["123"]);
    expect(formatInvoicePhoneListInput("2035550100,2035550101")).toBe(
      "(203) 555-0100, (203) 555-0101",
    );
  });
});
