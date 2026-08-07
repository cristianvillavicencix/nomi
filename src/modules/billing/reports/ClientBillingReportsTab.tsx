import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { BillingReportsCollections } from "@/modules/billing/reports/BillingReportsCollections";
import { BillingReportsOverview } from "@/modules/billing/reports/BillingReportsOverview";
import { BillingReportsProducts } from "@/modules/billing/reports/BillingReportsProducts";
import { BillingReportsProjections } from "@/modules/billing/reports/BillingReportsProjections";
import { BillingReportsRevenue } from "@/modules/billing/reports/BillingReportsRevenue";
import { BillingReportsToolbar } from "@/modules/billing/reports/BillingReportsToolbar";
import {
  parseBillingReportCustomerParam,
} from "@/modules/billing/reports/billingReportFilters";
import {
  ReportDataCapBanner,
  ReportDocumentHeader,
} from "@/modules/billing/reports/ReportUi";
import {
  buildBillingReportsSearchParams,
  BILLING_REPORT_VIEWS,
  resolveBillingReportCompare,
  resolveBillingReportFilters,
  resolveBillingReportPeriod,
  resolveBillingReportScenario,
  resolveBillingReportView,
  type BillingReportCompareId,
  type BillingReportPeriodId,
  type BillingReportViewId,
} from "@/modules/billing/reports/reportsNavigation";
import { defaultScenarioAssumptions } from "@/modules/billing/reports/billingReportProjections";
import { useBillingReportsData } from "@/modules/billing/reports/useBillingReportsData";

const ReportsFilteredEmptyState = () => (
  <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
    No billing data matches these filters for this period.
  </div>
);

export const ClientBillingReportsTab = () => {
  const { title, companyLegalName } = useConfigurationContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = resolveBillingReportView(searchParams);
  const activePeriod = resolveBillingReportPeriod(searchParams);
  const compare = resolveBillingReportCompare(searchParams);
  const filters = resolveBillingReportFilters(searchParams);

  const scenarioDefaults = useMemo(
    () => defaultScenarioAssumptions([]),
    [],
  );
  const scenario = resolveBillingReportScenario(searchParams, scenarioDefaults);

  const {
    snapshot,
    customerOptions,
    productOptions,
    customerLabel,
    productLabel,
    isPending,
    hasActiveFilters,
    dataCapReached,
    invoices,
    subscriptions,
  } = useBillingReportsData(activePeriod, filters, scenario, compare);

  const reportTitle =
    BILLING_REPORT_VIEWS.find((view) => view.id === activeView)?.label ??
    "Report";
  const orgLabel = companyLegalName?.trim() || title || "Organization";

  const updateSearchParams = (
    view: BillingReportViewId,
    period: BillingReportPeriodId,
    nextFilters = filters,
    nextScenario = scenario,
    nextCompare: BillingReportCompareId = compare,
  ) => {
    setSearchParams(
      buildBillingReportsSearchParams(view, period, {
        filters: nextFilters,
        scenario: nextScenario,
        compare: nextCompare,
      }),
    );
  };

  const handleCustomerChange = (value: string | null) => {
    updateSearchParams(activeView, activePeriod, {
      customer: value ? parseBillingReportCustomerParam(value) : undefined,
      product: filters.product,
    });
  };

  const handleProductChange = (value: string | null) => {
    updateSearchParams(activeView, activePeriod, {
      customer: filters.customer,
      product: value ?? undefined,
    });
  };

  const handleClearFilters = () => {
    updateSearchParams(activeView, activePeriod, {}, scenario, "none");
  };

  const handleScenarioChange = (nextScenario: typeof scenario) => {
    updateSearchParams(activeView, activePeriod, filters, nextScenario);
  };

  const handleCompareChange = (nextCompare: BillingReportCompareId) => {
    updateSearchParams(activeView, activePeriod, filters, scenario, nextCompare);
  };

  const hasFilteredRecords = invoices.length > 0 || subscriptions.length > 0;
  const showFilteredEmpty = hasActiveFilters && !isPending && !hasFilteredRecords;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <BillingReportsToolbar
        activeView={activeView}
        activePeriod={activePeriod}
        compare={compare}
        filters={filters}
        snapshot={snapshot}
        customerOptions={customerOptions}
        productOptions={productOptions}
        customerLabel={customerLabel}
        productLabel={productLabel}
        isPending={isPending}
        hasActiveFilters={hasActiveFilters || compare !== "none"}
        onViewChange={(view) => updateSearchParams(view, activePeriod)}
        onPeriodChange={(period) => updateSearchParams(activeView, period)}
        onCompareChange={handleCompareChange}
        onCustomerChange={handleCustomerChange}
        onProductChange={handleProductChange}
        onClearFilters={handleClearFilters}
      />

      {dataCapReached ? <ReportDataCapBanner /> : null}

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <div className="space-y-6">
          <ReportDocumentHeader
            orgLabel={orgLabel}
            reportTitle={reportTitle}
            range={snapshot.range}
          />

          {showFilteredEmpty ? (
            <ReportsFilteredEmptyState />
          ) : activeView === "revenue" ? (
            <BillingReportsRevenue snapshot={snapshot} isPending={isPending} />
          ) : activeView === "collections" ? (
            <BillingReportsCollections
              snapshot={snapshot}
              isPending={isPending}
            />
          ) : activeView === "products" ? (
            <BillingReportsProducts snapshot={snapshot} isPending={isPending} />
          ) : activeView === "projections" ? (
            <BillingReportsProjections
              snapshot={snapshot}
              isPending={isPending}
              scenario={scenario}
              onScenarioChange={handleScenarioChange}
            />
          ) : (
            <BillingReportsOverview snapshot={snapshot} isPending={isPending} />
          )}
        </div>
      </div>
    </div>
  );
};
