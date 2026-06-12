import { FileText } from "lucide-react";
import { useEffect } from "react";
import { useListContext } from "ra-core";
import { useSearchParams } from "react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { InvoiceListSidebar } from "@/lbs/billing/InvoiceListSidebar";
import { StandaloneInvoiceEditPage } from "@/lbs/billing/StandaloneInvoiceEditPage";
import type { ClientInvoice } from "@/lbs/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const InvoiceBillingWorkspace = () => {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedInvoiceId = searchParams.get("invoice");
  const { data: invoices = [] } = useListContext<ClientInvoice>();

  useEffect(() => {
    if (!invoices.length) {
      if (selectedInvoiceId) setSearchParams({}, { replace: true });
      return;
    }

    const selectedStillVisible = selectedInvoiceId
      ? invoices.some((row) => String(row.id) === selectedInvoiceId)
      : false;

    if (selectedInvoiceId && !selectedStillVisible) {
      setSearchParams(
        isMobile ? {} : { invoice: String(invoices[0].id) },
        { replace: true },
      );
      return;
    }

    if (selectedInvoiceId || isMobile) return;
    setSearchParams({ invoice: String(invoices[0].id) }, { replace: true });
  }, [invoices, isMobile, selectedInvoiceId, setSearchParams]);

  const handleSelectInvoice = (invoiceId: string) => {
    setSearchParams({ invoice: invoiceId });
  };

  const handleBackToList = () => {
    setSearchParams({});
  };

  const showSidebar = !isMobile || !selectedInvoiceId;
  const showDetail = !isMobile || Boolean(selectedInvoiceId);

  return (
    <div className="flex min-h-[min(72vh,48rem)] overflow-hidden rounded-lg border bg-background">
      {showSidebar ? (
        <aside
          className={cn(
            "flex min-h-0 flex-col border-r bg-muted/10",
            isMobile ? "w-full" : "w-full max-w-[320px] shrink-0",
          )}
        >
          <div className="border-b px-3 py-2.5">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              All invoices
            </p>
          </div>
          <InvoiceListSidebar
            selectedInvoiceId={selectedInvoiceId}
            onSelectInvoice={handleSelectInvoice}
          />
        </aside>
      ) : null}

      {showDetail ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-100/80">
          {selectedInvoiceId ? (
            <>
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
                invoiceId={selectedInvoiceId}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <FileText className="size-10 opacity-40" />
              <p className="text-sm">Select an invoice to view and edit.</p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
};
