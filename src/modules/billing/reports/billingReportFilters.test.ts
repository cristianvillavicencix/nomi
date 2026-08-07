import { describe, expect, it } from "vitest";
import {
  filterInvoicesForReport,
  filterSubscriptionsForReport,
  invoiceMatchesProductFilter,
  parseBillingReportCustomerParam,
  subscriptionMatchesProductFilter,
} from "@/modules/billing/reports/billingReportFilters";
import type { ClientInvoice, ClientSubscription } from "@/modules/types";

const invoice: ClientInvoice = {
  id: 1,
  invoice_number: "INV-001",
  issue_date: "2026-07-01",
  due_date: "2026-07-10",
  amount: 100,
  description: "Website redesign",
  company_id: 10,
  contact_id: 20,
  status: "paid",
};

const subscription: ClientSubscription = {
  id: 2,
  name: "Monthly hosting",
  amount: 99,
  billing_interval: "monthly",
  company_id: 10,
  line_items: [{ description: "Hosting plan", quantity: 1, unit_price: 99 }],
  status: "active",
};

describe("billingReportFilters", () => {
  it("parses customer params", () => {
    expect(parseBillingReportCustomerParam("company:10")).toEqual({
      type: "company",
      id: "10",
    });
    expect(parseBillingReportCustomerParam("invalid")).toBeUndefined();
  });

  it("matches products on invoices and subscriptions", () => {
    expect(invoiceMatchesProductFilter(invoice, "website")).toBe(true);
    expect(subscriptionMatchesProductFilter(subscription, "hosting plan")).toBe(
      true,
    );
    expect(subscriptionMatchesProductFilter(subscription, "design")).toBe(false);
  });

  it("filters records by customer and product together", () => {
    const filteredInvoices = filterInvoicesForReport([invoice], {
      customer: { type: "company", id: "10" },
      product: "website",
    });
    expect(filteredInvoices).toHaveLength(1);

    const filteredSubscriptions = filterSubscriptionsForReport([subscription], {
      customer: { type: "contact", id: "20" },
      product: "hosting",
    });
    expect(filteredSubscriptions).toHaveLength(0);
  });
});
