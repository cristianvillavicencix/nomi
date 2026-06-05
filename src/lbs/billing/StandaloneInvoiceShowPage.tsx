import { ChevronLeft, Loader2 } from "lucide-react";
import { useMemo } from "react";
import {
  useGetList,
  useGetOne,
} from "ra-core";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { InvoiceDocumentPreview } from "@/lbs/billing/InvoiceDocumentPreview";
import { canEditClientInvoice } from "@/lbs/billing/billingUtils";
import {
  invoiceStatusLabel,
  invoiceStatusVariant,
} from "@/lbs/billing/billingDisplayUtils";
import { lineItemsToInvoiceDrafts } from "@/lbs/billing/invoiceLineUtils";
import type { ClientInvoice, ClientInvoiceLineItem } from "@/lbs/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const StandaloneInvoiceShowPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const {
    title: organizationName,
    companyWebsite,
    companyAddressLine1,
    companyAddressLine2,
    companyCity,
    companyState,
    companyPostalCode,
    companyCountry,
  } = useConfigurationContext();

  const organizationAddress = useMemo(() => {
    const parts = [
      companyAddressLine1,
      companyAddressLine2,
      [companyCity, companyState, companyPostalCode].filter(Boolean).join(", "),
      companyCountry,
    ].filter(Boolean);
    return parts.length ? parts.join("\n") : null;
  }, [
    companyAddressLine1,
    companyAddressLine2,
    companyCity,
    companyState,
    companyPostalCode,
    companyCountry,
  ]);

  const { data: invoice, isPending, error } = useGetOne<ClientInvoice>(
    "client_invoices",
    { id },
    { enabled: Boolean(id) },
  );

  const { data: lineItems = [] } = useGetList<ClientInvoiceLineItem>(
    "client_invoice_line_items",
    {
      filter: { "invoice_id@eq": id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
    },
    { enabled: Boolean(id) },
  );

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: invoice?.company_id ?? "" },
    { enabled: Boolean(invoice?.company_id) },
  );

  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: invoice?.contact_id ?? "" },
    { enabled: Boolean(invoice?.contact_id) },
  );

  const lines = useMemo(
    () => lineItemsToInvoiceDrafts(lineItems),
    [lineItems],
  );

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading invoice…
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
        <p>Invoice not found.</p>
        <Button type="button" variant="outline" asChild>
          <Link to="/billing">Back to Billing</Link>
        </Button>
      </div>
    );
  }

  if (canEditClientInvoice(invoice)) {
    return (
      <Navigate to={`/billing/invoices/${invoice.id}/edit`} replace />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-100/80">
      <div className="border-b bg-background px-4 py-3 md:px-6">
        <PageActions>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1 px-2"
            onClick={() => navigate("/billing", { state: { tab: "invoices" } })}
          >
            <ChevronLeft className="size-4" />
            Billing
          </Button>
          <PageTitle label={invoice.invoice_number} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Badge
              variant={invoiceStatusVariant(invoice.status, invoice.due_date)}
              className="capitalize"
            >
              {invoiceStatusLabel(invoice.status, invoice.due_date)}
            </Badge>
          </div>
        </PageActions>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <InvoiceDocumentPreview
          organizationName={organizationName}
          organizationWebsite={companyWebsite}
          organizationAddress={organizationAddress}
          invoiceNumber={invoice.invoice_number}
          status={invoice.status}
          issueDate={invoice.issue_date}
          dueDate={invoice.due_date}
          terms={invoice.terms ?? "Net 30"}
          company={company}
          contact={contact}
          lines={lines}
          termsAndConditions={invoice.notes}
          subtotal={Number(invoice.subtotal ?? invoice.amount) || 0}
          discountAmount={Number(invoice.discount_amount) || 0}
          feeAmount={Number(invoice.fee_amount) || 0}
          total={Number(invoice.amount) || 0}
        />
      </div>
    </div>
  );
};
