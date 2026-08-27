import { Download, ListFilter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

  const customerValue = filters.customer
    ? `${filters.customer.type}:${filters.customer.id}`
    : "all";

  const filtersActive = hasActiveFilters || compare !== "none";
  const compareLabel =
    BILLING_REPORT_COMPARE_OPTIONS.find((option) => option.id === compare)
      ?.label ?? "Compare";

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

  return (
    <div className="flex shrink-0 flex-col gap-2.5 px-4 pb-1 md:px-0">
      <div className="flex items-center gap-2">
        <Select
          value={activePeriod}
          onValueChange={(value) =>
            onPeriodChange(value as BillingReportPeriodId)
          }
        >
          <SelectTrigger
            aria-label="Report period"
            className="h-9 w-auto min-w-[4.25rem] rounded-full border-0 bg-black/[0.06] px-3 shadow-none dark:bg-white/10"
          >
            <SelectValue>
              {BILLING_REPORT_PERIODS.find((period) => period.id === activePeriod)
                ?.shortLabel ?? "Period"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {BILLING_REPORT_PERIODS.map((period) => (
              <SelectItem key={period.id} value={period.id}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {formatReportRangeDocumentLabel(snapshot.range)}
        </p>

        <Popover>
          <PopoverTrigger asChild>
            <IconButton
              variant={filtersActive ? "secondary" : "ghost"}
              className={cn(filtersActive && "border border-primary/30")}
              aria-label={
                filtersActive ? "Report filters (active)" : "Report filters"
              }
            >
              <ListFilter className="size-4" />
            </IconButton>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[min(100vw-2rem,320px)] space-y-4 p-4"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Filters</h3>
              <p className="text-xs text-muted-foreground">
                Customer, product, and comparison.
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

        <IconButton
          variant="ghost"
          aria-label="Export CSV"
          disabled={!canExport}
          onClick={handleExport}
        >
          <Download className="size-4" />
        </IconButton>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {BILLING_REPORT_VIEWS.map((view) => {
          const active = view.id === activeView;
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => onViewChange(view.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10",
              )}
            >
              {view.shortLabel}
            </button>
          );
        })}
      </div>

      {filtersActive ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {customerLabel ? <span>{customerLabel}</span> : null}
          {customerLabel && productLabel ? <span>·</span> : null}
          {productLabel ? <span>{productLabel}</span> : null}
          {compare !== "none" ? (
            <>
              {(customerLabel || productLabel) && <span>·</span>}
              <span>{compareLabel}</span>
            </>
          ) : null}
          <button
            type="button"
            onClick={onClearFilters}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
};
