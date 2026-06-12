import { describe, expect, it } from "vitest";
import {
  COMPANY_DRAFT_NAME_FIELD,
  COMPANY_DRAFT_SECTOR_FIELD,
  getCompanyDraftFromFormValues,
  hasCompanySelection,
  hasValidCompanyDraft,
  resolveContactCompanyForSave,
} from "./companyDraft";

describe("companyDraft (deferred create on new contact)", () => {
  it("stores new company only in form state until contact save", () => {
    const values = {
      company_id: null,
      [COMPANY_DRAFT_NAME_FIELD]: "Acme Roofing",
      [COMPANY_DRAFT_SECTOR_FIELD]: "roofing",
    };

    expect(getCompanyDraftFromFormValues(values)).toEqual({
      name: "Acme Roofing",
      sector: "roofing",
    });
    expect(hasValidCompanyDraft(values)).toBe(true);
    expect(hasCompanySelection(values)).toBe(true);

    const resolved = resolveContactCompanyForSave(values);
    expect(resolved.companyId).toBeNull();
    expect(resolved.companyDraft).toEqual({
      name: "Acme Roofing",
      sector: "roofing",
    });
  });

  it("after canceling contact dialog, draft fields leave no company to persist", () => {
    const cleared = {
      company_id: null,
      [COMPANY_DRAFT_NAME_FIELD]: "",
      [COMPANY_DRAFT_SECTOR_FIELD]: "",
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
        [COMPANY_DRAFT_NAME_FIELD]: "",
        [COMPANY_DRAFT_SECTOR_FIELD]: "",
      }),
    ).toEqual({
      companyId: 99,
      companyDraft: null,
    });
  });
});
