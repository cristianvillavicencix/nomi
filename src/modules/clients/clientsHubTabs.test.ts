import { describe, expect, it } from "vitest";
import { resolveClientsHubTab } from "./clientsHubTabs";

const params = (query: string) => new URLSearchParams(query);

describe("resolveClientsHubTab", () => {
  it("locks /companies to the companies tab", () => {
    expect(
      resolveClientsHubTab({
        pathname: "/companies",
        searchParams: params("tab=people"),
      }),
    ).toBe("companies");
  });

  it("locks /contacts to the people tab", () => {
    expect(
      resolveClientsHubTab({
        pathname: "/contacts",
        searchParams: params("tab=companies"),
      }),
    ).toBe("people");
  });

  it("defaults /clients to companies without a tab query", () => {
    expect(
      resolveClientsHubTab({
        pathname: "/clients",
        searchParams: params(""),
      }),
    ).toBe("companies");
  });

  it("honors ?tab=people on /clients", () => {
    expect(
      resolveClientsHubTab({
        pathname: "/clients",
        searchParams: params("tab=people"),
      }),
    ).toBe("people");
  });

  it("maps legacy ?tab=contacts to people on /clients", () => {
    expect(
      resolveClientsHubTab({
        pathname: "/clients",
        searchParams: params("tab=contacts"),
      }),
    ).toBe("people");
  });

  it("honors ?tab=companies on /clients", () => {
    expect(
      resolveClientsHubTab({
        pathname: "/clients",
        searchParams: params("tab=companies"),
      }),
    ).toBe("companies");
  });

  it("ignores unknown tab values and falls back to companies on /clients", () => {
    expect(
      resolveClientsHubTab({
        pathname: "/clients",
        searchParams: params("tab=prospects"),
      }),
    ).toBe("companies");
  });

  it("does not change tab when ?create= is present on /clients", () => {
    expect(
      resolveClientsHubTab({
        pathname: "/clients",
        searchParams: params("tab=people&create=contact"),
      }),
    ).toBe("people");
  });
});
