import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/atomic-crm/providers/supabase/supabase", () => ({
  supabase: {},
}));

import { companyToClientFormValues } from "./clientFormValues";
import {
  buildContactPayloadFromUpsert,
  buildCompanyPayloadFromUpsert,
  buildQuickClientUpsertInput,
  clientCreateFormValuesToUpsertInput,
  LBS_CLIENT_FORM_UNMANAGED_CONTACT_FIELDS,
  type LbsClientUpsertInput,
} from "./lbsClientUpsert";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyOwnEmails,
} from "./companyChannelResolvers";
import type { CompanyWithPrimaryContact } from "./clientProfile";

const baseInput = (): LbsClientUpsertInput => ({
  organizationMemberId: 1,
  companyId: 10,
  primaryContactId: 99,
  primary: {
    fullName: "Jane Smith",
    emails: [{ value: "jane@acme.com", type: "Work", isPrimary: true }],
    phones: [{ value: "5551234567", type: "Work", isPrimary: true }],
    address: "123 Main St",
  },
  business: {
    name: "Acme Corp",
    emails: [{ value: "info@acme.com", type: "Work", isPrimary: true }],
    phones: [{ value: "5559876543", type: "Work", isPrimary: true }],
  },
  billing: {
    sameAsBusiness: true,
    invoiceSameAsPrimary: true,
  },
});

describe("buildContactPayloadFromUpsert", () => {
  it("update mode omits fields not managed by the LBS client form", () => {
    const payload = buildContactPayloadFromUpsert(
      baseInput(),
      10,
      "update",
    ) as Record<string, unknown>;

    for (const field of LBS_CLIENT_FORM_UNMANAGED_CONTACT_FIELDS) {
      expect(payload).not.toHaveProperty(field);
    }
  });

  it("update mode still writes form-managed contact fields", () => {
    const payload = buildContactPayloadFromUpsert(baseInput(), 10, "update");

    expect(payload.first_name).toBe("Jane");
    expect(payload.last_name).toBe("Smith");
    expect(payload.email_jsonb).toEqual([
      { email: "jane@acme.com", type: "Work" },
    ]);
    expect(payload.phone_jsonb).toEqual([
      { number: "5551234567", type: "Work" },
    ]);
    expect(payload.last_seen).toBeTruthy();
  });

  it("create mode sets client defaults without nulling lead fields", () => {
    const payload = buildContactPayloadFromUpsert(
      baseInput(),
      10,
      "create",
    ) as Record<string, unknown>;

    expect(payload.status).toBe("client");
    expect(payload.tags).toEqual([]);
    expect(payload.first_seen).toBeTruthy();
    expect(payload).not.toHaveProperty("lead_source");
    expect(payload).not.toHaveProperty("interested_service");
  });
});

describe("buildQuickClientUpsertInput", () => {
  it("stores email and phone only on the primary contact, not the company", () => {
    const input = buildQuickClientUpsertInput(
      {
        businessName: "Acme Corp",
        contactName: "Jane Smith",
        email: "jane@acme.com",
        phone: "5551234567",
      },
      1,
    );

    expect(input.primary.emails).toHaveLength(1);
    expect(input.primary.phones).toHaveLength(1);
    expect(input.business.emails).toBeUndefined();
    expect(input.business.phones).toBeUndefined();
    expect(input.business.name).toBe("Acme Corp");
  });
});

describe("company channel resolvers", () => {
  it("resolveCompanyEmailForDisplay falls back to invoice email", () => {
    expect(
      resolveCompanyEmailForDisplay({
        context_links: [
          "lbs:invoice_email=realstateroofing@gmail.com",
          "lbs:invoice_phone=+1-5188675186",
        ],
        primary_contact_email_jsonb: [],
      }),
    ).toBe("realstateroofing@gmail.com");
  });

  it("resolveCompanyOwnEmails ignores contact and invoice data", () => {
    const rows = resolveCompanyOwnEmails([
      "lbs:invoice_email=realstateroofing@gmail.com",
    ]);
    expect(rows).toEqual([{ value: "", type: "Work", isPrimary: true }]);
  });
});

describe("context_links save invariant", () => {
  const companyWithLinks = (
    contextLinks: string[],
  ): CompanyWithPrimaryContact => ({
    id: 42,
    name: "Test Co",
    context_links: contextLinks,
    phone_number: "+15551234567",
    primary_contact_id: null,
    primary_contact_first_name: null,
    primary_contact_last_name: null,
    primary_contact_status: null,
    primary_contact_email_jsonb: null,
    primary_contact_phone_jsonb: null,
  });

  it("preserves context_links when saving two company-owned emails unchanged", () => {
    const existingLinks = [
      'lbs:company_emails=[{"email":"billing@test.co","type":"Billing"},{"email":"info@test.co","type":"Work"}]',
      "lbs:company_phones=[{\"number\":\"+15551234567\",\"type\":\"Work\"}]",
      "lbs:billing_same_as_business=true",
      "lbs:invoice_same_as_primary=true",
      "lbs:invoice_email=info@test.co",
      "lbs:invoice_phone=+15551234567",
    ];

    const formValues = companyToClientFormValues(companyWithLinks(existingLinks));
    const payload = buildCompanyPayloadFromUpsert(
      {
        ...clientCreateFormValuesToUpsertInput(formValues, 1),
        companyId: 42,
      },
      existingLinks,
    );

    expect(JSON.stringify(payload.context_links)).toBe(
      JSON.stringify(existingLinks),
    );
  });

  it("preserves invoice-only context_links on unchanged save", () => {
    const existingLinks = [
      "lbs:company_phones=[{\"number\":\"+1-5188675186\",\"type\":\"Work\"}]",
      "lbs:billing_same_as_business=true",
      "lbs:invoice_same_as_primary=true",
      "lbs:invoice_contact_name=Jose Lema",
      "lbs:invoice_email=realstateroofing@gmail.com",
      "lbs:invoice_phone=+1-5188675186",
    ];

    const formValues = companyToClientFormValues(companyWithLinks(existingLinks));
    const payload = buildCompanyPayloadFromUpsert(
      {
        ...clientCreateFormValuesToUpsertInput(formValues, 1),
        companyId: 42,
      },
      existingLinks,
    );

    expect(JSON.stringify(payload.context_links)).toBe(
      JSON.stringify(existingLinks),
    );
  });
});
