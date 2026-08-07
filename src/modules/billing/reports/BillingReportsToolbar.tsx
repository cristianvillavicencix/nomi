import { ChevronDown, Download, ListFilter, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type {
  BillingReportCustomerOption,
  BillingReportFilters,
} from "@/modules/billing/reports/billingReportFilters";
import {
  exportBillingReportCsv,
  hasExportableBillingReportData,
} from "@/modules/billing/reports/billingReportsExport";
import type { BillingReportsSnapshot } from "@/modules/billing/reports/billingReportsAggregation";
import {
  BILLING_REPORT_COMPARE_OPTIONS,
  BILLING_REPORT_PERIODS,
  BILLING_REPORT_VIEWS,
  type BillingReportCompareId,
  type BillingReportPeriodId,
  type BillingReportViewId,
} from "@/modules/billing/reports/reportsNavigation";
import { formatReportRangeDocumentLabel } from "@/modules/billing/reports/reportPeriodUtils";
import { cn } from "@/lib/utils";

type BillingReportsToolbarProps = {
  activeView: BillingReportViewId;
  activePeriod: BillingReportPeriodId;
  compare: BillingReportCompareId;
  filters: BillingReportFilters;
  snapshot: BillingReportsSnapshot;
  customerOptions: BillingReportCustomerOption[];
  productOptions: string[];
  customerLabel?: string | null;
  productLabel?: string | null;
  isPending: boolean;
  hasActiveFilters: boolean;
  onViewChange: (view: BillingReportViewId) => void;
  onPeriodChange: (period: BillingReportPeriodId) => void;
  onCompareChange: (compare: BillingReportCompareId) => void;
  onCustomerChange: (value: string | null) => void;
  onProductChange: (value: string | null) => void;
  onClearFilters: () => void;
};

export const BillingReportsToolbar = ({
  activeView,
  activePeriod,
  compare,
  filters,
  snapshot,
  customerOptions,
  productOptions,
  customerLabel,
  productLabel,
  isPending,
  hasActiveFilters,
  onViewChange,
  onPeriodChange,
  onCompareChange,
  onCustomerChange,
  onProductChange,
  onClearFilters,
}: BillingReportsToolbarProps) => {
  const canExport =
    !isPending && hasExportableBillingReportData(snapshot, activeView);
  const activeViewLabel =
    BILLING_REPORT_VIEWS.find((view) => view.id === activeView)?.label ??
    "Report";

  const customerValue = filters.customer
    ? `${filters.customer.type}:${filters.customer.id}`
    : "all";

  const handleExport = () => {
    exportBillingReportCsv({
      view: activeView,
      period: activePeriod,
      snapshot,
      filters,
      customerLabel,
      productLabel,
    });
  };

  const filtersActive = hasActiveFilters || compare !== "none";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Billing · Reports
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold">
            {activeViewLabel}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {formatReportRangeDocumentLabel(snapshot.range)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={filtersActive ? "secondary" : "outline"}
                size="icon"
                className={cn(
                  "shrink-0",
                  filtersActive && "border-primary/30",
                )}
                aria-label={
                  filtersActive ? "Report filters (active)" : "Report filters"
                }
              >
                <ListFilter className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(100vw-2rem,320px)] space-y-4 p-4"
            >
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Filters</h3>
                <p className="text-xs text-muted-foreground">
                  Customer, product, and comparison options.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-filter-customer">Customer</Label>
                <Select
                  value={customerValue}
                  onValueChange={(value) =>
                    onCustomerChange(value === "all" ? null : value)
                  }
                >
                  <SelectTrigger id="report-filter-customer" className="w-full">
                    <SelectValue placeholder="All customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All customers</SelectItem>
                    {customerOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-filter-product">Product</Label>
                <Select
                  value={filters.product ?? "all"}
                  onValueChange={(value) =>
                    onProductChange(value === "all" ? null : value)
                  }
                >
                  <SelectTrigger id="report-filter-product" className="w-full">
                    <SelectValue placeholder="All products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All products</SelectItem>
                    {productOptions.map((product) => (
                      <SelectItem key={product} value={product}>
                        {product}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-filter-compare">Compare with</Label>
                <Select
                  value={compare}
                  onValueChange={(value) =>
                    onCompareChange(value as BillingReportCompareId)
                  }
                >
                  <SelectTrigger id="report-filter-compare" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_REPORT_COMPARE_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filtersActive ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClearFilters}
                  className="w-full justify-start px-2"
                >
                  <X className="size-4" />
                  Clear filters
                </Button>
              ) : null}
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canExport}
              >
                <Download className="size-4" />
                Export
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleExport}>
                Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs
        value={activeView}
        onValueChange={(next) => onViewChange(next as BillingReportViewId)}
      >
        <TabsList className="inline-flex h-10 w-full max-w-full justify-start gap-1 overflow-x-auto p-1">
          {BILLING_REPORT_VIEWS.map((view) => (
            <TabsTrigger key={view.id} value={view.id} className="shrink-0">
              {view.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Tabs
        value={activePeriod}
        onValueChange={(next) => onPeriodChange(next as BillingReportPeriodId)}
      >
        <TabsList className="inline-flex h-10 w-full max-w-full justify-start gap-1 overflow-x-auto p-1">
          {BILLING_REPORT_PERIODS.map((period) => (
            <TabsTrigger key={period.id} value={period.id} className="shrink-0">
              {period.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Active filters:</span>
          {customerLabel ? <span>{customerLabel}</span> : null}
          {customerLabel && productLabel ? <span>·</span> : null}
          {productLabel ? <span>{productLabel}</span> : null}
          {compare !== "none" ? (
            <>
              {(customerLabel || productLabel) && <span>·</span>}
              <span>Compare previous period</span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
