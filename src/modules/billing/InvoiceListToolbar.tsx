import { ChevronDown, Plus } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { useGetList } from "ra-core";
import { BillingStatusFilterMenu } from "@/modules/billing/BillingStatusFilterMenu";
import {
  countInvoicesByStatusFilter,
  INVOICE_FILTER_OPTIONS,
  type InvoiceStatusFilter,
} from "@/modules/billing/billingDisplayUtils";
import type { ClientInvoice } from "@/modules/types";
import { Button } from "@/components/ui/button";
import { ModuleSearchField } from "@/components/atomic-crm/layout/ModuleToolbar";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type InvoiceListToolbarProps = {
  statusFilter: InvoiceStatusFilter;
  onStatusFilterChange: (next: InvoiceStatusFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (next: string) => void;
  onFromProposal: () => void;
  /** Sidebar with detail open: New stacks below search. Full list: New on the same row. */
  compact?: boolean;
  /** Hide create controls when the mobile page chrome already shows +. */
  hideCreate?: boolean;
};

export const InvoiceListToolbar = ({
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  onFromProposal,
  compact = false,
  hideCreate = false,
}: InvoiceListToolbarProps) => {
  const isMobile = useIsMobile();
  const { data: invoices = [] } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "issue_date", order: "DESC" },
      filter: {},
    },
    { staleTime: 30_000 },
  );

  const counts = useMemo(
    () => countInvoicesByStatusFilter(invoices),
    [invoices],
  );

  const searchField = (
    <ModuleSearchField
      value={searchQuery}
      onChange={onSearchQueryChange}
      basePlaceholder="Search by client, number, amount"
      total={counts.all}
      itemSingular="invoice"
      className="w-full min-w-0 flex-1 [&>div]:max-w-none"
    />
  );

  const newButtonGroup = (
    <div
      className={
        compact
          ? "flex w-full items-stretch"
          : "flex shrink-0 items-stretch"
      }
    >
      <Button
        type="button"
        variant="primary"
        size="sm"
        className={compact ? "min-w-0 flex-1 rounded-r-none" : "rounded-r-none"}
        asChild
      >
        <Link to="/billing/invoices/new" aria-label="New invoice">
          <Plus className="size-4" />
          New invoice
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="shrink-0 rounded-l-none border-l border-primary-foreground/20 px-2"
            aria-label="More create options"
          >
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onFromProposal}>
            <Plus className="size-4" />
            From proposal
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // Mobile hub: full-width search like Projects / Tickets / Accounts.
  // Create lives in MobilePageChrome as a + icon.
  if (isMobile) {
    return (
      <div className="flex w-full min-w-0 items-center gap-2 px-4 pb-1">
        <BillingStatusFilterMenu
          value={statusFilter}
          onChange={onStatusFilterChange}
          options={INVOICE_FILTER_OPTIONS}
          counts={counts}
          ariaLabel="Filter invoices"
        />
        {searchField}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex shrink-0 flex-col gap-2 border-b bg-background px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <BillingStatusFilterMenu
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={INVOICE_FILTER_OPTIONS}
            counts={counts}
            ariaLabel="Filter invoices"
          />
          {searchField}
        </div>
        {hideCreate ? null : newButtonGroup}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-b bg-background px-3 py-2">
      <BillingStatusFilterMenu
        value={statusFilter}
        onChange={onStatusFilterChange}
        options={INVOICE_FILTER_OPTIONS}
        counts={counts}
        ariaLabel="Filter invoices"
      />
      {searchField}
      {hideCreate ? null : newButtonGroup}
    </div>
  );
};
