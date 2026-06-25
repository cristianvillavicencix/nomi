import { describe, expect, it } from "vitest";
import {
  COMPANY_DRAFT_NAME_FIELD,
  COMPANY_DRAFT_SECTOR_FIELD,
  companyDraftToCreateData,
  getCompanyDraftFromFormValues,
  hasCompanySelection,
  hasValidCompanyDraft,
  resolveContactCompanyForSave,
} from "./companyDraft";

describe("companyDraft (deferred create on new contact)", () => {
  it("stores new company only in form state until contact save", () => {
    const values = {
      company_id: null,
      company_draft_name: "Acme Roofing",
      company_draft_sector: "roofing",
      company_draft_website: "https://acme.example",
      company_draft_phone: "555-0100",
      company_draft_address: "123 Main St",
    };

    expect(getCompanyDraftFromFormValues(values)).toEqual({
      name: "Acme Roofing",
      sector: "roofing",
      website: "https://acme.example",
      phone: "555-0100",
      address: "123 Main St",
    });
    expect(hasValidCompanyDraft(values)).toBe(true);
    expect(hasCompanySelection(values)).toBe(true);

    const resolved = resolveContactCompanyForSave(values);
    expect(resolved.companyId).toBeNull();
    expect(resolved.companyDraft).toEqual({
      name: "Acme Roofing",
      sector: "roofing",
      website: "https://acme.example",
      phone: "555-0100",
      address: "123 Main St",
    });
  });

  it("reads legacy _company_draft_* keys when present", () => {
    expect(
      getCompanyDraftFromFormValues({
        _company_draft_name: "Legacy Co",
        _company_draft_sector: "hvac",
      }),
    ).toEqual({
      name: "Legacy Co",
      sector: "hvac",
      website: "",
      phone: "",
      address: "",
    });
  });

  it("prefers company_id over draft fields", () => {
    expect(
      resolveContactCompanyForSave({
        company_id: 42,
        company_draft_name: "Draft Co",
        company_draft_sector: "roofing",
      }),
    ).toEqual({
      companyId: 42,
      companyDraft: null,
    });
  });

  it("after canceling contact dialog, draft fields leave no company to persist", () => {
    const cleared = {
      company_id: null,
      company_draft_name: "",
      company_draft_sector: "",
    };

    expect(getCompanyDraftFromFormValues(cleared)).toBeNull();
    expect(hasValidCompanyDraft(cleared)).toBe(false);
    expect(hasCompanySelection(cleared)).toBe(false);
    expect(resolveContactCompanyForSave(cleared)).toEqual({
      companyId: null,
      companyDraft: null,
    });
  });

  it("links an existing company id without draft fields", () => {
    expect(
      resolveContactCompanyForSave({
        company_id: 99,
        company_draft_name: "",
        company_draft_sector: "",
      }),
    ).toEqual({
      companyId: 99,
      companyDraft: null,
    });
  });

  it("maps draft to company create payload with website normalization", () => {
    expect(
      companyDraftToCreateData(
        {
          name: "Acme",
          sector: "roofing",
          website: "acme.example",
          phone: "555-0100",
          address: "123 Main",
        },
        7,
      ),
    ).toMatchObject({
      name: "Acme",
      sector: "roofing",
      website: "https://acme.example",
      phone_number: "555-0100",
      address: "123 Main",
      organization_member_id: 7,
    });
  });
});
