import { ChevronDown, FileText, Plus } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useListContext } from "ra-core";
import { useSearchParams } from "react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { InvoiceListSidebar } from "@/modules/billing/InvoiceListSidebar";
import { StandaloneInvoiceEditPage } from "@/modules/billing/StandaloneInvoiceEditPage";
import {
  INVOICE_FILTER_OPTIONS,
  type InvoiceStatusFilter,
} from "@/modules/billing/billingDisplayUtils";
import type { ClientInvoice } from "@/modules/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type InvoiceBillingWorkspaceProps = {
  statusFilter: InvoiceStatusFilter;
  onStatusFilterChange: (next: InvoiceStatusFilter) => void;
  /** Renders the "+ New invoice" / "From proposal" actions inside the sidebar header dropdown. */
  createMenuItems: ReactNode;
};

const filterLabel = (value: InvoiceStatusFilter) =>
  INVOICE_FILTER_OPTIONS.find((option) => option.value === value)?.label ??
  "All";

export const InvoiceBillingWorkspace = ({
  statusFilter,
  onStatusFilterChange,
  createMenuItems,
}: InvoiceBillingWorkspaceProps) => {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedInvoiceId = searchParams.get("invoice");
  const { data: invoices = [] } = useListContext<ClientInvoice>();

  // Clear stale ?invoice= if the selected row dropped out of the filter window.
  useEffect(() => {
    if (!selectedInvoiceId) return;
    if (!invoices.length) {
      setSearchParams({}, { replace: true });
      return;
    }
    const stillVisible = invoices.some(
      (row) => String(row.id) === selectedInvoiceId,
    );
    if (!stillVisible) {
      setSearchParams({}, { replace: true });
    }
  }, [invoices, selectedInvoiceId, setSearchParams]);

  const handleSelectInvoice = (invoiceId: string) => {
    setSearchParams({ invoice: invoiceId });
  };

  const handleBackToList = () => {
    setSearchParams({});
  };

  const hasSelection = Boolean(selectedInvoiceId);
  const showSidebar = !isMobile || !hasSelection;
  const showDetail = !isMobile || hasSelection;

  const sidebarHeader = (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1 px-2 font-semibold"
          >
            {filterLabel(statusFilter)} invoices
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={statusFilter}
            onValueChange={(value) =>
              onStatusFilterChange(value as InvoiceStatusFilter)
            }
          >
            {INVOICE_FILTER_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="default"
              size="icon"
              className="size-7"
              aria-label="Create invoice"
            >
              <Plus className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {createMenuItems}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden rounded-lg border bg-background">
      {showSidebar ? (
        <aside
          className={cn(
            "flex min-h-0 flex-col bg-muted/10",
            hasSelection && !isMobile && "w-full max-w-[320px] shrink-0 border-r",
            (!hasSelection || isMobile) && "w-full",
          )}
        >
          {sidebarHeader}
          <InvoiceListSidebar
            selectedInvoiceId={selectedInvoiceId}
            onSelectInvoice={handleSelectInvoice}
          />
        </aside>
      ) : null}

      {showDetail && hasSelection ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-100/80 dark:bg-slate-900/40">
          {isMobile ? (
            <div className="border-b bg-background px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBackToList}
              >
                ← All invoices
              </Button>
            </div>
          ) : null}
          <StandaloneInvoiceEditPage
            embedded
            invoiceId={selectedInvoiceId ?? undefined}
          />
        </section>
      ) : !showSidebar ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
          <FileText className="size-10 opacity-40" />
          <p className="text-sm">Select an invoice to view and edit.</p>
        </section>
      ) : null}
    </div>
  );
};
