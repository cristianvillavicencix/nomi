import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { maskAmountIfNeeded } from "@/lib/permissions/amountMasking";

describe("maskAmountIfNeeded", () => {
  it("masks or formats amounts based on permission", () => {
    assert.equal(maskAmountIfNeeded(1234.5, false), "—");
    assert.equal(maskAmountIfNeeded(null, true), "—");
    assert.equal(maskAmountIfNeeded(1000, true), "$1,000.00");
  });
});
