import { describe, expect, it } from "vitest";
import { isValidRecordId } from "./isValidRecordId";

describe("isValidRecordId", () => {
  it("accepts finite numbers and non-empty strings", () => {
    expect(isValidRecordId(42)).toBe(true);
    expect(isValidRecordId("42")).toBe(true);
  });

  it("rejects null, undefined, empty string, and whitespace", () => {
    expect(isValidRecordId(null)).toBe(false);
    expect(isValidRecordId(undefined)).toBe(false);
    expect(isValidRecordId("")).toBe(false);
    expect(isValidRecordId("   ")).toBe(false);
  });
});
