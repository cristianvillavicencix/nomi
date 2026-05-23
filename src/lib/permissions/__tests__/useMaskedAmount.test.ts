import assert from "node:assert/strict";
import { maskAmountIfNeeded } from "@/lib/permissions/amountMasking";

assert.equal(maskAmountIfNeeded(1234.5, false), "—");
assert.equal(maskAmountIfNeeded(null, true), "—");
assert.equal(maskAmountIfNeeded(1000, true), "$1,000.00");

console.warn("useMaskedAmount tests passed");
