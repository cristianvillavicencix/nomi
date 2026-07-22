import { describe, expect, it } from "vitest";
import type { Contact } from "@/components/atomic-crm/types";
import {
  dealBelongsToCompany,
  resolvePrimaryContactId,
} from "@/modules/work/workCreateAccountLinkUtils";

const contact = (id: number, companyId = 1): Contact =>
  ({
    id,
    company_id: companyId,
    first_name: `First${id}`,
    last_name: `Last${id}`,
  }) as Contact;

describe("resolvePrimaryContactId", () => {
  it("returns null when no company is selected", () => {
    expect(resolvePrimaryContactId(null, 5, [contact(5)])).toBeNull();
  });

  it("keeps a valid contact for the company", () => {
    const contacts = [contact(5), contact(6)];
    expect(resolvePrimaryContactId(1, 6, contacts, 5)).toBe(6);
  });

  it("auto-selects the only company contact", () => {
    expect(resolvePrimaryContactId(1, null, [contact(5)])).toBe(5);
  });

  it("auto-selects the company primary contact", () => {
    const contacts = [contact(5), contact(6)];
    expect(resolvePrimaryContactId(1, null, contacts, 6)).toBe(6);
  });

  it("clears an invalid contact selection", () => {
    const contacts = [contact(5), contact(6)];
    expect(resolvePrimaryContactId(1, 99, contacts, null)).toBeNull();
  });
});

describe("dealBelongsToCompany", () => {
  it("matches ids as strings or numbers", () => {
    expect(dealBelongsToCompany(10, "10")).toBe(true);
    expect(dealBelongsToCompany(10, 11)).toBe(false);
  });
});
