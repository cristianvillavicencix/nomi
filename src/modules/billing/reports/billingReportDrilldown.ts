import type { InvoiceStatusFilter } from "@/modules/billing/billingDisplayUtils";
import type { SubscriptionStatusFilter } from "@/modules/billing/subscriptions/subscriptionDisplayUtils";

export type BillingReportDrilldownTarget =
  | { tab: "invoices"; invoiceStatus?: InvoiceStatusFilter }
  | { tab: "subscriptions"; subscriptionStatus?: SubscriptionStatusFilter };

export const buildBillingReportDrilldownPath = (
  target: BillingReportDrilldownTarget,
) => {
  const params = new URLSearchParams();
  params.set("tab", target.tab);
  if (target.tab === "invoices" && target.invoiceStatus) {
    params.set("invoice_status", target.invoiceStatus);
  }
  if (target.tab === "subscriptions" && target.subscriptionStatus) {
    params.set("subscription_status", target.subscriptionStatus);
  }
  return `/billing?${params.toString()}`;
};

export const BILLING_REPORT_DRILLDOWN = {
  collected: buildBillingReportDrilldownPath({
    tab: "invoices",
    invoiceStatus: "paid",
  }),
  invoiced: buildBillingReportDrilldownPath({ tab: "invoices" }),
  outstanding: buildBillingReportDrilldownPath({
    tab: "invoices",
    invoiceStatus: "sent",
  }),
  overdue: buildBillingReportDrilldownPath({
    tab: "invoices",
    invoiceStatus: "overdue",
  }),
  pendingSetup: buildBillingReportDrilldownPath({
    tab: "subscriptions",
    subscriptionStatus: "pending_setup",
  }),
  activeSubscriptions: buildBillingReportDrilldownPath({
    tab: "subscriptions",
    subscriptionStatus: "active",
  }),
  activeMrr: buildBillingReportDrilldownPath({
    tab: "subscriptions",
    subscriptionStatus: "active",
  }),
} as const;

export const BILLING_REPORTS_DATA_CAP = 1000;
