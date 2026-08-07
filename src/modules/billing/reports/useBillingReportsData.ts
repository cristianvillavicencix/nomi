import { useMemo } from "react";
import { useGetList, useGetMany } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { computeBillingReportsSnapshot } from "@/modules/billing/reports/billingReportsAggregation";
import {
  attachOverviewComparison,
  getPreviousReportDateRange,
} from "@/modules/billing/reports/billingReportComparison";
import {
  extractReportCustomerOptions,
  extractReportProductOptions,
  filterInvoicesForReport,
  filterSubscriptionsForReport,
  hasActiveBillingReportFilters,
  type BillingReportFilters,
} from "@/modules/billing/reports/billingReportFilters";
import { BILLING_REPORTS_DATA_CAP } from "@/modules/billing/reports/billingReportDrilldown";
import {
  defaultScenarioAssumptions,
  type BillingReportScenarioAssumptions,
} from "@/modules/billing/reports/billingReportProjections";
import type {
  BillingReportCompareId,
  BillingReportPeriodId,
} from "@/modules/billing/reports/reportsNavigation";
import type { ClientInvoice, ClientSubscription } from "@/modules/types";

export const useBillingReportsData = (
  period: BillingReportPeriodId,
  filters: BillingReportFilters = {},
  scenario?: BillingReportScenarioAssumptions,
  compare: BillingReportCompareId = "none",
) => {
  const { data: invoices = [], isPending: invoicesPending, total: invoiceTotal } =
    useGetList<ClientInvoice>(
      "client_invoices",
      {
        pagination: { page: 1, perPage: BILLING_REPORTS_DATA_CAP },
        sort: { field: "issue_date", order: "DESC" },
        filter: {},
      },
      { staleTime: 30_000 },
    );

  const {
    data: subscriptions = [],
    isPending: subscriptionsPending,
    total: subscriptionTotal,
  } = useGetList<ClientSubscription>(
    "client_subscriptions",
    {
      pagination: { page: 1, perPage: BILLING_REPORTS_DATA_CAP },
      sort: { field: "created_at", order: "DESC" },
      filter: {},
    },
    { staleTime: 30_000 },
  );

  const companyIds = useMemo(
    () => [
      ...new Set(
        [...invoices, ...subscriptions]
          .map((row) => row.company_id)
          .filter((id): id is NonNullable<typeof id> => id != null),
      ),
    ],
    [invoices, subscriptions],
  );

  const contactIds = useMemo(
    () => [
      ...new Set(
        [...invoices, ...subscriptions]
          .map((row) => row.contact_id)
          .filter((id): id is NonNullable<typeof id> => id != null),
      ),
    ],
    [invoices, subscriptions],
  );

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );

  const companyById = useMemo(
    () => new Map(companies.map((company) => [String(company.id), company])),
    [companies],
  );
  const contactById = useMemo(
    () => new Map(contacts.map((contact) => [String(contact.id), contact])),
    [contacts],
  );

  const filteredInvoices = useMemo(
    () => filterInvoicesForReport(invoices, filters),
    [filters, invoices],
  );
  const filteredSubscriptions = useMemo(
    () => filterSubscriptionsForReport(subscriptions, filters),
    [filters, subscriptions],
  );

  const activeSubscriptionsForDefaults = useMemo(
    () =>
      filteredSubscriptions.filter(
        (row) => row.status === "active" || row.status === "trialing",
      ),
    [filteredSubscriptions],
  );

  const resolvedScenario = useMemo(
    () => scenario ?? defaultScenarioAssumptions(activeSubscriptionsForDefaults),
    [activeSubscriptionsForDefaults, scenario],
  );

  const referenceDate = useMemo(() => new Date(), []);

  const baseSnapshot = useMemo(
    () =>
      computeBillingReportsSnapshot(
        filteredInvoices,
        filteredSubscriptions,
        period,
        referenceDate,
        {
          filters: hasActiveBillingReportFilters(filters) ? filters : undefined,
          scenario: resolvedScenario,
        },
      ),
    [filteredInvoices, filteredSubscriptions, filters, period, referenceDate, resolvedScenario],
  );

  const previousRange = useMemo(
    () => getPreviousReportDateRange(period, referenceDate),
    [period, referenceDate],
  );

  const previousSnapshot = useMemo(() => {
    if (compare !== "previous_period") return null;
    return computeBillingReportsSnapshot(
      filteredInvoices,
      filteredSubscriptions,
      period,
      referenceDate,
      {
        filters: hasActiveBillingReportFilters(filters) ? filters : undefined,
        scenario: resolvedScenario,
        rangeOverride: previousRange,
      },
    );
  }, [
    compare,
    filteredInvoices,
    filteredSubscriptions,
    filters,
    period,
    previousRange,
    referenceDate,
    resolvedScenario,
  ]);

  const snapshot = useMemo(
    () =>
      attachOverviewComparison(
        baseSnapshot,
        previousSnapshot,
        previousRange.label.toLowerCase(),
      ),
    [baseSnapshot, previousSnapshot, previousRange.label],
  );

  const customerOptions = useMemo(
    () =>
      extractReportCustomerOptions(
        invoices,
        subscriptions,
        companyById,
        contactById,
      ),
    [companyById, contactById, invoices, subscriptions],
  );

  const productOptions = useMemo(
    () => extractReportProductOptions(invoices, subscriptions),
    [invoices, subscriptions],
  );

  const customerLabel = useMemo(() => {
    if (!filters.customer) return null;
    return (
      customerOptions.find(
        (option) =>
          option.type === filters.customer?.type &&
          option.id === filters.customer.id,
      )?.label ?? null
    );
  }, [customerOptions, filters.customer]);

  const dataCapReached =
    invoices.length >= BILLING_REPORTS_DATA_CAP ||
    subscriptions.length >= BILLING_REPORTS_DATA_CAP ||
    (invoiceTotal ?? 0) > BILLING_REPORTS_DATA_CAP ||
    (subscriptionTotal ?? 0) > BILLING_REPORTS_DATA_CAP;

  return {
    snapshot,
    invoices: filteredInvoices,
    subscriptions: filteredSubscriptions,
    rawInvoices: invoices,
    rawSubscriptions: subscriptions,
    customerOptions,
    productOptions,
    customerLabel,
    productLabel: filters.product ?? null,
    isPending: invoicesPending || subscriptionsPending,
    hasActiveFilters: hasActiveBillingReportFilters(filters),
    dataCapReached,
    compare,
  };
};
