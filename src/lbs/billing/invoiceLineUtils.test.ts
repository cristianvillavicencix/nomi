import { describe, expect, it } from "vitest";
import {
  calculateInvoiceTotals,
  calculateTransferFee,
} from "./invoiceLineUtils";

describe("calculateTransferFee", () => {
  it("grosses up so Stripe 2.9% + $0.30 is fully covered on a $650 subtotal", () => {
    expect(calculateTransferFee(650)).toBe(19.72);
  });

  it("returns zero for non-positive subtotals", () => {
    expect(calculateTransferFee(0)).toBe(0);
    expect(calculateTransferFee(-10)).toBe(0);
  });
});

describe("calculateInvoiceTotals", () => {
  it("adds grossed-up fee to line subtotal", () => {
    const { subtotal, feeAmount, total } = calculateInvoiceTotals([
      {
        key: "1",
        title: "Service",
        quantity: 1,
        unit: "ea",
        unit_price: 650,
        sort_order: 0,
      },
    ]);

    expect(subtotal).toBe(650);
    expect(feeAmount).toBe(19.72);
    expect(total).toBe(669.72);
  });
});
