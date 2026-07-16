import { describe, expect, it } from "vitest";
import {
  canAccessAccountsBoard,
  canAccessAccountsHub,
  canAccessAccountsList,
  getAccessibleAccountsViews,
  resolveDefaultAccountsView,
} from "./accountsHubAccess";

const administrator = { administrator: true };

const companiesOnly = {
  administrator: false,
  module_permissions: { "crm.companies.view": true },
};

const contactsOnly = {
  administrator: false,
  module_permissions: { "crm.contacts.view": true },
};

const noAccess = {
  administrator: false,
  module_permissions: { "crm.pipeline.view": true },
};

describe("accountsHubAccess", () => {
  it("grants list and board to administrators", () => {
    expect(canAccessAccountsList(administrator)).toBe(true);
    expect(canAccessAccountsBoard(administrator)).toBe(true);
    expect(canAccessAccountsHub(administrator)).toBe(true);
    expect(getAccessibleAccountsViews(administrator)).toEqual([
      "list",
      "board",
    ]);
  });

  it("grants list only for companies-only users", () => {
    expect(canAccessAccountsList(companiesOnly)).toBe(true);
    expect(canAccessAccountsBoard(companiesOnly)).toBe(false);
    expect(getAccessibleAccountsViews(companiesOnly)).toEqual(["list"]);
    expect(resolveDefaultAccountsView(companiesOnly, "board")).toBe("list");
  });

  it("grants board and list (people) for contacts-only users", () => {
    expect(canAccessAccountsList(contactsOnly)).toBe(true);
    expect(canAccessAccountsBoard(contactsOnly)).toBe(true);
    expect(getAccessibleAccountsViews(contactsOnly)).toEqual([
      "list",
      "board",
    ]);
  });

  it("denies hub when neither companies nor contacts are accessible", () => {
    expect(canAccessAccountsHub(noAccess)).toBe(false);
    expect(resolveDefaultAccountsView(noAccess)).toBeNull();
    expect(canAccessAccountsHub(null)).toBe(false);
  });

  it("honors a requested accessible view", () => {
    expect(resolveDefaultAccountsView(administrator, "board")).toBe("board");
    expect(resolveDefaultAccountsView(administrator, "list")).toBe("list");
  });
});
