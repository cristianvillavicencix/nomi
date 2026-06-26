import { describe, expect, it } from "vitest";
import {
  buildClientsHubTabChangeParams,
  getClientsHubTabNavigateTarget,
  syncClientsHubSearchParams,
} from "./clientsHubSearchParams";

const params = (query: string) => new URLSearchParams(query);

describe("syncClientsHubSearchParams", () => {
  it("removes tab when companies is active but the URL still has a tab param", () => {
    const result = syncClientsHubSearchParams(
      "companies",
      params("tab=people"),
    );
    expect(result?.has("tab")).toBe(false);
  });

  it("keeps companies URL when tab param is already absent", () => {
    expect(syncClientsHubSearchParams("companies", params(""))).toBeNull();
  });

  it("sets tab=people when people is active without a tab param", () => {
    const result = syncClientsHubSearchParams("people", params(""));
    expect(result?.get("tab")).toBe("people");
  });

  it("normalizes legacy tab=contacts to people", () => {
    expect(
      syncClientsHubSearchParams("people", params("tab=contacts")),
    ).toBeNull();
  });

  it("replaces a denied companies tab request for contacts-only users", () => {
    const result = syncClientsHubSearchParams(
      "people",
      params("tab=companies"),
    );
    expect(result?.get("tab")).toBe("people");
  });

  it("preserves unrelated query params such as create", () => {
    const result = syncClientsHubSearchParams(
      "people",
      params("tab=companies&create=contact"),
    );
    expect(result?.get("tab")).toBe("people");
    expect(result?.get("create")).toBe("contact");
  });
});

describe("buildClientsHubTabChangeParams", () => {
  it("clears tab when switching to companies", () => {
    const result = buildClientsHubTabChangeParams(
      "companies",
      params("tab=people&foo=1"),
    );
    expect(result.get("tab")).toBeNull();
    expect(result.get("foo")).toBe("1");
  });

  it("sets tab=people when switching to people", () => {
    const result = buildClientsHubTabChangeParams("people", params("foo=1"));
    expect(result.get("tab")).toBe("people");
    expect(result.get("foo")).toBe("1");
  });
});

describe("getClientsHubTabNavigateTarget", () => {
  it("navigates from /companies to /contacts when switching to people", () => {
    const target = getClientsHubTabNavigateTarget(
      "people",
      "/companies",
      params("foo=1"),
    );
    expect(target).toEqual({ type: "pathname", path: "/contacts?foo=1" });
  });

  it("navigates from /contacts to /companies when switching to companies", () => {
    const target = getClientsHubTabNavigateTarget(
      "companies",
      "/contacts",
      params("create=contact"),
    );
    expect(target).toEqual({
      type: "pathname",
      path: "/companies?create=contact",
    });
  });

  it("updates search params on /clients", () => {
    const target = getClientsHubTabNavigateTarget(
      "people",
      "/clients",
      params(""),
    );
    expect(target.type).toBe("search");
    if (target.type === "search") {
      expect(target.params.get("tab")).toBe("people");
    }
  });
});
