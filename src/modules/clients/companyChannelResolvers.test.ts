import { describe, expect, it } from "vitest";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyOwnEmails,
  resolveCompanyOwnPhones,
  resolveCompanyPhoneForDisplay,
} from "./companyChannelResolvers";

describe("resolveCompanyEmailForDisplay", () => {
  it("prefers company-owned email keys over contact and invoice", () => {
    expect(
      resolveCompanyEmailForDisplay({
        context_links: [
          "lbs:business_email=info@company.com",
          "lbs:invoice_email=invoice@company.com",
        ],
        primary_contact_email_jsonb: [
          { email: "person@company.com", type: "Work" },
        ],
      }),
    ).toBe("info@company.com");
  });

  it("uses company_emails array when business_email is absent", () => {
    expect(
      resolveCompanyEmailForDisplay({
        context_links: [
          'lbs:company_emails=[{"email":"ops@company.com","type":"Work"}]',
        ],
        primary_contact_email_jsonb: [],
      }),
    ).toBe("ops@company.com");
  });
});

describe("resolveCompanyOwnEmails", () => {
  it("never hydrates from contact or invoice keys", () => {
    expect(
      resolveCompanyOwnEmails(["lbs:invoice_email=invoice@company.com"]),
    ).toEqual([{ value: "", type: "Work", isPrimary: true }]);
  });
});

describe("resolveCompanyPhoneForDisplay", () => {
  it("falls back to invoice phone", () => {
    expect(
      resolveCompanyPhoneForDisplay({
        context_links: ["lbs:invoice_phone=+1-5188675186"],
        phone_number: null,
        primary_contact_phone_jsonb: [],
      }),
    ).toBe("(518) 867-5186");
  });
});

describe("resolveCompanyOwnPhones", () => {
  it("hydrates only phone_number and company_phones", () => {
    expect(
      resolveCompanyOwnPhones(
        ['lbs:company_phones=[{"number":"+15551112222","type":"Work"}]'],
        "+15559998888",
      ),
    ).toEqual([{ value: "+15551112222", type: "Work", isPrimary: true }]);
  });
});
