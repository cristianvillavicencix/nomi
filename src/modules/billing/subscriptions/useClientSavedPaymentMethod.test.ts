import { describe, expect, it } from "vitest";
import { pickLatestSavedPaymentMethod } from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import type { ClientInvoice, Contract } from "@/modules/types";

describe("pickLatestSavedPaymentMethod", () => {
  it("returns null when no saved cards exist", () => {
    expect(pickLatestSavedPaymentMethod([], [])).toBeNull();
  });

  it("prefers the most recently updated card across invoices and contracts", () => {
    const invoices: ClientInvoice[] = [
      {
        id: 1,
        stripe_payment_method_id: "pm_invoice",
        payment_method_brand: "visa",
        payment_method_last4: "4242",
        updated_at: "2026-01-01T00:00:00.000Z",
      } as ClientInvoice,
    ];

    const contracts: Contract[] = [
      {
        id: 2,
        stripe_payment_method_id: "pm_contract",
        payment_method_brand: "mastercard",
        payment_method_last4: "5555",
        updated_at: "2026-06-01T00:00:00.000Z",
      } as Contract,
    ];

    expect(pickLatestSavedPaymentMethod(invoices, contracts)).toEqual({
      brand: "mastercard",
      last4: "5555",
      source: "contract",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
  });

  it("ignores rows without stripe payment method id", () => {
    const invoices: ClientInvoice[] = [
      {
        id: 1,
        payment_method_brand: "visa",
        payment_method_last4: "4242",
        updated_at: "2026-06-01T00:00:00.000Z",
      } as ClientInvoice,
    ];

    expect(pickLatestSavedPaymentMethod(invoices, [])).toBeNull();
  });
});
