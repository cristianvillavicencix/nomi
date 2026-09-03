import { describe, expect, it } from "vitest";
import {
  formatPaymentMethodLabel,
  pickLatestSavedPaymentMethod,
} from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import type { ClientInvoice, ClientSubscription, Contract } from "@/modules/types";

describe("pickLatestSavedPaymentMethod", () => {
  it("returns null when no saved cards exist", () => {
    expect(pickLatestSavedPaymentMethod([], [])).toBeNull();
  });

  it("prefers the most recently updated card across invoices, contracts, and subscriptions", () => {
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

    const subscriptions: ClientSubscription[] = [
      {
        id: 3,
        name: "Hosting",
        amount: 99,
        billing_interval: "monthly",
        stripe_payment_method_id: "pm_sub",
        payment_method_brand: "amex",
        payment_method_last4: "1111",
        updated_at: "2026-08-01T00:00:00.000Z",
      } as ClientSubscription,
    ];

    expect(pickLatestSavedPaymentMethod(invoices, contracts, subscriptions)).toEqual({
      brand: "amex",
      last4: "1111",
      source: "subscription",
      updatedAt: "2026-08-01T00:00:00.000Z",
      stripePaymentMethodId: "pm_sub",
      stripeCustomerId: null,
    });
  });

  it("formats Link wallets without a fake ····0000 mask", () => {
    expect(formatPaymentMethodLabel("link", "0000")).toBe("Link");
    expect(formatPaymentMethodLabel("Link", null)).toBe("Link");
    expect(formatPaymentMethodLabel("visa", "4242")).toBe("Visa ····4242");
  });
});
