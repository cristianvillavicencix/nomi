import { describe, expect, it } from "vitest";
import { invoiceListTotals } from "@/modules/billing/invoicePaymentUtils";
import { invoiceStatusSidebarLabel } from "@/modules/billing/invoiceStatusSidebarLabel";

describe("invoiceListTotals", () => {
  it("treats half-paid sent invoices as partial with remaining balance", () => {
    const row = invoiceListTotals({
      amount: 1128.01,
      amount_paid: 564.01,
      status: "sent",
    });
    expect(row.isPartial).toBe(true);
    expect(row.balance).toBe(564);
  });

  it("does not mark paid invoices as partial", () => {
    expect(
      invoiceListTotals({
        amount: 100,
        amount_paid: 100,
        status: "paid",
      }).isPartial,
    ).toBe(false);
  });
});

describe("invoiceStatusSidebarLabel", () => {
  it("prefixes due labels when partially paid", () => {
    expect(
      invoiceStatusSidebarLabel("sent", null, { isPartial: true }),
    ).toBe("Partial · Sent");
  });
});
