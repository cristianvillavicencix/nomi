import { describe, expect, it } from "vitest";
import {
  contactNeedsCompanyMove,
  shouldClearPrimaryOnCompany,
} from "./primaryContactRelink";

describe("primaryContactRelink", () => {
  it("detects when a contact belongs to another company", () => {
    expect(contactNeedsCompanyMove(10, 20)).toBe(true);
    expect(contactNeedsCompanyMove(10, 10)).toBe(false);
    expect(contactNeedsCompanyMove(null, 10)).toBe(false);
  });

  it("detects when the moving contact is the saved primary", () => {
    expect(shouldClearPrimaryOnCompany(99, 99)).toBe(true);
    expect(shouldClearPrimaryOnCompany(88, 99)).toBe(false);
    expect(shouldClearPrimaryOnCompany(null, 99)).toBe(false);
  });
});
