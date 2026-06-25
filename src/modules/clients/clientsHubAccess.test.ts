import { describe, expect, it } from "vitest";
import {
  canAccessClientsHubTab,
  getAccessibleClientsHubTabs,
  resolveDefaultClientsHubTab,
} from "./clientsHubAccess";

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

describe("canAccessClientsHubTab", () => {
  it("grants both tabs to administrators", () => {
    expect(canAccessClientsHubTab(administrator, "companies")).toBe(true);
    expect(canAccessClientsHubTab(administrator, "people")).toBe(true);
  });

  it("grants only companies when the user has companies list access", () => {
    expect(canAccessClientsHubTab(companiesOnly, "companies")).toBe(true);
    expect(canAccessClientsHubTab(companiesOnly, "people")).toBe(false);
  });

  it("grants only people when the user has contacts list access", () => {
    expect(canAccessClientsHubTab(contactsOnly, "people")).toBe(true);
    expect(canAccessClientsHubTab(contactsOnly, "companies")).toBe(false);
  });
});

describe("getAccessibleClientsHubTabs", () => {
  it("returns both tabs in order for administrators", () => {
    expect(getAccessibleClientsHubTabs(administrator)).toEqual([
      "companies",
      "people",
    ]);
  });

  it("returns only companies for companies-only users", () => {
    expect(getAccessibleClientsHubTabs(companiesOnly)).toEqual(["companies"]);
  });

  it("returns only people for contacts-only users", () => {
    expect(getAccessibleClientsHubTabs(contactsOnly)).toEqual(["people"]);
  });

  it("returns an empty list when the user has no hub access", () => {
    expect(getAccessibleClientsHubTabs(noAccess)).toEqual([]);
    expect(getAccessibleClientsHubTabs(null)).toEqual([]);
  });
});

describe("resolveDefaultClientsHubTab", () => {
  it("returns the requested tab when it is accessible", () => {
    expect(
      resolveDefaultClientsHubTab(administrator, "people"),
    ).toBe("people");
  });

  it("falls back to the first accessible tab when the request is denied", () => {
    expect(
      resolveDefaultClientsHubTab(contactsOnly, "companies"),
    ).toBe("people");
    expect(
      resolveDefaultClientsHubTab(companiesOnly, "people"),
    ).toBe("companies");
  });

  it("defaults to the first accessible tab when no tab is requested", () => {
    expect(resolveDefaultClientsHubTab(contactsOnly)).toBe("people");
    expect(resolveDefaultClientsHubTab(companiesOnly)).toBe("companies");
  });

  it("returns null when the user cannot access any tab", () => {
    expect(resolveDefaultClientsHubTab(noAccess, "people")).toBeNull();
    expect(resolveDefaultClientsHubTab(null)).toBeNull();
  });
});
