import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useGetList, useGetOne } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { InvoiceDocumentPreview } from "@/modules/billing/InvoiceDocumentPreview";
import { StandaloneInvoiceEditPage } from "@/modules/billing/StandaloneInvoiceEditPage";
import { computeInvoiceBalanceDue } from "@/modules/billing/invoicePaymentUtils";
import { resolveInvoiceOrganizationName } from "@/modules/billing/invoiceEmailTemplate";
import { getInvoiceOrganizationBranding } from "@/modules/billing/invoiceOrganizationInfo";
import type { ClientInvoice, ClientInvoiceLineItem } from "@/modules/types";
import { clientInvoiceLineItemsToDrafts } from "@/modules/tickets/ticketInvoicePreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type TicketInvoiceViewMode = "view" | "edit";

type TicketInvoiceViewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TicketInvoiceViewMode;
  invoiceId: number;
  company?: Company | null;
  contact?: Contact | null;
};

export const TicketInvoiceViewDialog = ({
  open,
  onOpenChange,
  mode,
  invoiceId,
  company,
  contact,
}: TicketInvoiceViewDialogProps) => {
  const { title, companyLegalName } = useConfigurationContext();
  const id = String(invoiceId);

  const { data: invoice, isPending: invoicePending } = useGetOne<ClientInvoice>(
    "client_invoices",
    { id },
    { enabled: open && Boolean(invoiceId) },
  );

  const { data: lineItems = [], isPending: linesPending } =
    useGetList<ClientInvoiceLineItem>(
      "client_invoice_line_items",
      {
        filter: { "invoice_id@eq": id },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "sort_order", order: "ASC" },
      },
      { enabled: open && Boolean(invoiceId) && mode === "view" },
    );

  const organizationName = useMemo(
    () => resolveInvoiceOrganizationName({ title, companyLegalName }),
    [title, companyLegalName],
  );
  const invoiceBranding = useMemo(() => getInvoiceOrganizationBranding(), []);

  const previewLines = useMemo(
    () => clientInvoiceLineItemsToDrafts(lineItems),
    [lineItems],
  );

  const isLoading = mode === "view" && (invoicePending || linesPending || !invoice);

  const dialogWidthClass =
    mode === "edit"
      ? "sm:max-w-[min(96vw,90rem)]"
      : "sm:max-w-[min(96vw,calc(210mm+5rem))]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92vh,900px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0",
          dialogWidthClass,
        )}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {mode === "edit" ? "Edit invoice" : "View invoice"}
            {invoice ? (
              <Badge variant="outline" className="font-mono text-xs font-normal">
                {invoice.invoice_number}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update line items and invoice details without leaving the ticket."
              : "Invoice preview for this supplement ticket."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {mode === "edit" ? (
            <div className="flex min-h-[min(70vh,640px)] flex-col">
              <StandaloneInvoiceEditPage embedded invoiceId={id} />
            </div>
          ) : isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center px-6 py-4 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading invoice…
            </div>
          ) : invoice ? (
            <div className="px-6 py-4">
              <InvoiceDocumentPreview
                organizationName={organizationName}
                organizationWebsite={invoiceBranding.website}
                organizationAddress={invoiceBranding.address}
                invoiceNumber={invoice.invoice_number}
                status={invoice.status}
                issueDate={invoice.issue_date}
                dueDate={invoice.due_date}
                terms={invoice.terms ?? "Due on receipt"}
                company={company}
                contact={contact}
                lines={previewLines}
                subtotal={Number(invoice.subtotal) || undefined}
                feeAmount={Number(invoice.fee_amount) || undefined}
                total={Number(invoice.amount) || 0}
                balanceDue={computeInvoiceBalanceDue(
                  Number(invoice.amount) || 0,
                  Number(invoice.amount_paid) || 0,
                )}
              />
            </div>
          ) : (
            <p className="px-6 py-4 text-sm text-destructive">
              Could not load this invoice.
            </p>
          )}
        </div>

        {mode === "view" ? (
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
