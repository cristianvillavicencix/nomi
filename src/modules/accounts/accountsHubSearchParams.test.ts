import { describe, expect, it } from "vitest";
import {
  buildAccountsHubViewChangeParams,
  parseAccountsHubView,
  syncAccountsHubSearchParams,
} from "./accountsHubSearchParams";

describe("accountsHubSearchParams", () => {
  it("parses view query values", () => {
    expect(parseAccountsHubView("list")).toBe("list");
    expect(parseAccountsHubView("board")).toBe("board");
    expect(parseAccountsHubView("kanban")).toBeNull();
    expect(parseAccountsHubView(null)).toBeNull();
  });

  it("syncs board into the query string", () => {
    const next = syncAccountsHubSearchParams("board", new URLSearchParams());
    expect(next?.get("view")).toBe("board");
  });

  it("removes redundant view=list from the query string", () => {
    const current = new URLSearchParams("view=list&create=company");
    const next = syncAccountsHubSearchParams("list", current);
    expect(next?.has("view")).toBe(false);
    expect(next?.get("create")).toBe("company");
  });

  it("builds view change params without dropping unrelated keys", () => {
    const current = new URLSearchParams("create=lead");
    const board = buildAccountsHubViewChangeParams("board", current);
    expect(board.get("view")).toBe("board");
    expect(board.get("create")).toBe("lead");
    const list = buildAccountsHubViewChangeParams("list", board);
    expect(list.has("view")).toBe(false);
    expect(list.get("create")).toBe("lead");
  });
});
