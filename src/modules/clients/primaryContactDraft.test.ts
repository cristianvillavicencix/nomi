import { describe, expect, it } from "vitest";
import { hasPrimaryContactInput } from "./lbsClientUpsert";
import {
  getLinkingContactDraftFromPersonForm,
  getPrimaryContactDraftFromFormValues,
  hasPendingPrimaryOnCreate,
  resolveCreatePrimaryUpsertOptions,
} from "./primaryContactDraft";

describe("primaryContactDraft (deferred create on new company)", () => {
  it("stores new contact only in form state until company save", () => {
    const draft = getPrimaryContactDraftFromFormValues({
      selected_primary_contact_id: null,
      primary_full_name: "Jane Doe",
      primary_email: "jane@example.com",
      primary_phone: "",
    });

    expect(draft).toEqual({
      fullName: "Jane Doe",
      email: "jane@example.com",
      phone: "",
    });

    const upsert = resolveCreatePrimaryUpsertOptions({
      selected_primary_contact_id: null,
      primary_full_name: "Jane Doe",
      primary_email: "jane@example.com",
      primary_phone: "",
    });

    expect(upsert.primaryContactId).toBeUndefined();
    expect(upsert.linkPrimaryContactOnly).toBe(false);
    expect(
      hasPrimaryContactInput({
        primaryContactId: upsert.primaryContactId,
        primary: {
          fullName: "Jane Doe",
          emails: [
            { value: "jane@example.com", type: "Work", isPrimary: true },
          ],
          phones: [],
        },
      }),
    ).toBe(true);
  });

  it("after canceling company dialog, draft fields leave no contact id to persist", () => {
    const cleared = getPrimaryContactDraftFromFormValues({
      selected_primary_contact_id: null,
      primary_full_name: "",
      primary_email: "",
      primary_phone: "",
    });

    expect(cleared).toBeNull();
    expect(
      hasPendingPrimaryOnCreate({
        selected_primary_contact_id: null,
        primary_full_name: "",
        primary_email: "",
        primary_phone: "",
      }),
    ).toBe(false);
    expect(
      resolveCreatePrimaryUpsertOptions({
        selected_primary_contact_id: null,
        primary_full_name: "",
        primary_email: "",
        primary_phone: "",
      }).primaryContactId,
    ).toBeUndefined();
  });

  it("links an existing contact id without draft fields", () => {
    expect(
      resolveCreatePrimaryUpsertOptions({
        selected_primary_contact_id: 42,
        primary_full_name: "",
        primary_email: "",
        primary_phone: "",
      }),
    ).toEqual({
      primaryContactId: 42,
      linkPrimaryContactOnly: true,
    });
  });
});

describe("getLinkingContactDraftFromPersonForm", () => {
  it("builds a draft from in-progress person form values", () => {
    expect(
      getLinkingContactDraftFromPersonForm({
        first_name: "Jane",
        last_name: "Doe",
        email_jsonb: [{ email: "jane@example.com", type: "Work" }],
        phone_jsonb: [{ number: "(646) 546-1427", type: "Work" }],
      }),
    ).toEqual({
      fullName: "Jane Doe",
      email: "jane@example.com",
      phone: "(646) 546-1427",
    });
  });

  it("returns null when the person form has no identity yet", () => {
    expect(
      getLinkingContactDraftFromPersonForm({
        first_name: "",
        last_name: "",
        email_jsonb: [{ email: "", type: "Work" }],
        phone_jsonb: [{ number: "", type: "Work" }],
      }),
    ).toBeNull();
  });
});
