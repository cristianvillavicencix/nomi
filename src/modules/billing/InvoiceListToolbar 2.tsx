import { ChevronDown, Plus } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { useGetList } from "ra-core";
import {
  countInvoicesByStatusFilter,
  INVOICE_FILTER_OPTIONS,
  type InvoiceStatusFilter,
} from "@/modules/billing/billingDisplayUtils";
import type { ClientInvoice } from "@/modules/types";
import { Button } from "@/components/ui/button";
import { ModuleSearchField } from "@/components/atomic-crm/layout/ModuleToolbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type InvoiceListToolbarProps = {
  statusFilter: InvoiceStatusFilter;
  onStatusFilterChange: (next: InvoiceStatusFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (next: string) => void;
  onFromProposal: () => void;
};

export const InvoiceListToolbar = ({
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  onFromProposal,
}: InvoiceListToolbarProps) => {
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

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b bg-background px-3 py-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <ModuleSearchField
          value={searchQuery}
          onChange={onSearchQueryChange}
          basePlaceholder="Search by client, number, amount"
          total={counts.all}
          itemSingular="invoice"
        />

        <div className="flex shrink-0 items-stretch sm:ml-auto">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="rounded-r-none"
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
                className="rounded-l-none border-l border-primary-foreground/20 px-2"
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
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {INVOICE_FILTER_OPTIONS.map((option) => {
          const active = statusFilter === option.value;
          const count = counts[option.value];
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={active ? "secondary" : "ghost"}
              className={cn(
                "h-7 shrink-0 gap-1.5 px-2.5 text-xs",
                active && "bg-muted font-medium",
              )}
              onClick={() => onStatusFilterChange(option.value)}
              aria-pressed={active}
            >
              {option.label}
              <span
                className={cn(
                  "tabular-nums text-muted-foreground",
                  active && "text-foreground",
                )}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
