import { describe, expect, it } from "vitest";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  resolveBillingRecipientEmail,
  resolveBillingRecipientPhone,
  resolveCompanyBillingEmail,
} from "@/modules/billing/billingRecipientResolution";

describe("billing recipient resolution (Option A)", () => {
  const company = {
    id: 1,
    name: "Acme",
    context_links: [
      "lbs:invoice_email=billing@acme.com",
      "lbs:invoice_phone=2035546470",
      "lbs:company_emails=" +
        JSON.stringify([
          { email: "info@acme.com", type: "Work" },
          { email: "sales@acme.com", type: "Work" },
        ]),
    ],
    primary_contact_email_jsonb: [{ email: "owner@acme.com" }],
    primary_contact_phone_jsonb: [{ number: "2039999999" }],
    phone_number: "2038888888",
  } as Company;

  const contact = {
    id: 2,
    email_jsonb: [{ email: "person@acme.com" }],
    phone_jsonb: [{ number: "2036141494" }],
  } as Contact;

  it("prefers company invoice email over contact and requester", () => {
    expect(
      resolveBillingRecipientEmail({
        company,
        contact,
        ticketRequesterEmail: "requester@example.com",
      }),
    ).toBe("billing@acme.com");
  });

  it("prefers company invoice phone over linked contact phone", () => {
    expect(resolveBillingRecipientPhone({ company, contact })).toBe(
      "2035546470",
    );
  });

  it("falls back to contact email when company has no billing channels", () => {
    expect(
      resolveBillingRecipientEmail({
        company: { id: 1, name: "Empty Co" } as Company,
        contact,
        ticketRequesterEmail: "requester@example.com",
      }),
    ).toBe("person@acme.com");
  });

  it("uses company channel list when invoice email is missing", () => {
    expect(
      resolveCompanyBillingEmail({
        id: 1,
        context_links: company.context_links?.filter(
          (link) => !link.startsWith("lbs:invoice_email="),
        ),
      } as Company),
    ).toBe("info@acme.com");
  });
});
