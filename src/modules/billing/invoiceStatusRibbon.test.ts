import { describe, expect, it } from "vitest";
import { resolveInvoiceStatusRibbon } from "@/modules/billing/invoiceStatusRibbon";

describe("resolveInvoiceStatusRibbon", () => {
  it("marks overdue sent invoices", () => {
    const ribbon = resolveInvoiceStatusRibbon({
      status: "sent",
      due_date: "2000-01-01",
    });
    expect(ribbon?.label).toBe("Overdue");
    expect(ribbon?.tone).toBe("destructive");
    expect(ribbon?.className).toContain("bg-destructive");
  });

  it("marks paid invoices", () => {
    expect(
      resolveInvoiceStatusRibbon({ status: "paid", due_date: null })?.label,
    ).toBe("Paid");
  });

  it("marks sent unpaid invoices", () => {
    expect(
      resolveInvoiceStatusRibbon({
        status: "sent",
        due_date: "2099-12-31",
      })?.label,
    ).toBe("Sent");
  });
});
