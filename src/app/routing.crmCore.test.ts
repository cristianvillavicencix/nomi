import { describe, expect, it } from "vitest";
import {
  getAccountsHubPath,
  getClientShowPath,
  getContactShowPath,
  getLeadShowPath,
  getLeadsListPath,
  getPersonShowPath,
} from "@/app/routing";

describe("CRM core routing (Account → Person → Deal)", () => {
  it("hub list and board paths", () => {
    expect(getAccountsHubPath()).toBe("/accounts");
    expect(getAccountsHubPath("board")).toBe("/accounts?view=board");
    expect(getLeadsListPath()).toBe("/accounts?view=board");
  });

  it("Account Full stays on companies show", () => {
    expect(getClientShowPath(42)).toBe("/companies/42");
  });

  it("Person Full is always contacts show (lead status does not fork URL)", () => {
    expect(getContactShowPath(7)).toBe("/contacts/7/show");
    expect(getLeadShowPath(7)).toBe("/contacts/7/show");
    expect(getPersonShowPath({ id: 7, status: "lead" })).toBe(
      "/contacts/7/show",
    );
    expect(getPersonShowPath({ id: 7, status: "client" })).toBe(
      "/contacts/7/show",
    );
  });
});
