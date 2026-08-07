import { FileText } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { InvoiceBillingSummaryCards } from "@/modules/billing/InvoiceBillingSummaryCards";
import { InvoiceListSidebar } from "@/modules/billing/InvoiceListSidebar";
import { InvoiceListTable } from "@/modules/billing/InvoiceListTable";
import { InvoiceListToolbar } from "@/modules/billing/InvoiceListToolbar";
import { StandaloneInvoiceEditPage } from "@/modules/billing/StandaloneInvoiceEditPage";
import { type InvoiceStatusFilter } from "@/modules/billing/billingDisplayUtils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InvoiceBillingWorkspaceProps = {
  statusFilter: InvoiceStatusFilter;
  onStatusFilterChange: (next: InvoiceStatusFilter) => void;
  onFromProposal: () => void;
  /** Summary metric cards sit under the module toolbar (list view only). */
  showSummaryCards?: boolean;
};

export const InvoiceBillingWorkspace = ({
  statusFilter,
  onStatusFilterChange,
  onFromProposal,
  showSummaryCards = false,
}: InvoiceBillingWorkspaceProps) => {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const selectedInvoiceId = searchParams.get("invoice");

  const handleSelectInvoice = (invoiceId: string) => {
    setSearchParams({ invoice: invoiceId });
  };

  const handleBackToList = () => {
    setSearchParams({});
  };

  const hasSelection = Boolean(selectedInvoiceId);
  const showSidebar = !isMobile || !hasSelection;
  const showDetail = !isMobile || hasSelection;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 overflow-hidden bg-background",
        hasSelection && !isMobile
          ? "h-full rounded-none border-0"
          : "rounded-lg border",
      )}
    >
      {showSidebar ? (
        <aside
          className={cn(
            "flex min-h-0 flex-col bg-muted/10",
            hasSelection &&
              !isMobile &&
              "w-full max-w-[320px] shrink-0 border-r",
            (!hasSelection || isMobile) && "w-full",
          )}
        >
          <InvoiceListToolbar
            statusFilter={statusFilter}
            onStatusFilterChange={onStatusFilterChange}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onFromProposal={onFromProposal}
            compact={hasSelection && !isMobile}
          />
          {showSummaryCards && !hasSelection ? (
            <div className="shrink-0 border-b bg-background px-3 py-2">
              <InvoiceBillingSummaryCards
                statusFilter={statusFilter}
                onStatusFilterChange={onStatusFilterChange}
              />
            </div>
          ) : null}
          {hasSelection || isMobile ? (
            <InvoiceListSidebar
              selectedInvoiceId={selectedInvoiceId}
              onSelectInvoice={handleSelectInvoice}
              searchQuery={searchQuery}
            />
          ) : (
            <InvoiceListTable
              selectedInvoiceId={selectedInvoiceId}
              onSelectInvoice={handleSelectInvoice}
              searchQuery={searchQuery}
            />
          )}
        </aside>
      ) : null}

      {showDetail && hasSelection ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/50">
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
