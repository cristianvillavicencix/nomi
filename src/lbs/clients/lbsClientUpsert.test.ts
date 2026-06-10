import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/atomic-crm/providers/supabase/supabase", () => ({
  supabase: {},
}));

import {
  buildContactPayloadFromUpsert,
  buildQuickClientUpsertInput,
  LBS_CLIENT_FORM_UNMANAGED_CONTACT_FIELDS,
  type LbsClientUpsertInput,
} from "./lbsClientUpsert";

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
