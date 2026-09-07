import { Mail } from "lucide-react";
import { EmptyState, ListSkeleton } from "@/modules/shared/chrome";
import { useMemo } from "react";
import { useGetMany, useListContext } from "ra-core";
import type { Company } from "@/components/atomic-crm/types";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import {
  invoiceStatusSidebarLabel,
  invoiceStatusSidebarVariant,
} from "@/modules/billing/invoiceStatusSidebarLabel";
import { invoiceMatchesSearchQuery } from "@/modules/billing/invoiceListSearch";
import { invoiceListTotals } from "@/modules/billing/invoicePaymentUtils";
import type { ClientInvoice } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/lib/permissions/MoneyText";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type InvoiceListTableProps = {
  selectedInvoiceId?: string | null;
  onSelectInvoice: (invoiceId: string) => void;
  searchQuery?: string;
};

export const InvoiceListTable = ({
  selectedInvoiceId,
  onSelectInvoice,
  searchQuery = "",
}: InvoiceListTableProps) => {
  const { data: invoices = [], isPending } = useListContext<ClientInvoice>();

  const companyIds = useMemo(
    () => [
      ...new Set(
        invoices
          .map((row) => row.company_id)
          .filter(
            (id): id is NonNullable<ClientInvoice["company_id"]> => id != null,
          ),
      ),
    ],
    [invoices],
  );

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );

  const companyById = useMemo(
    () => new Map(companies.map((company) => [String(company.id), company])),
    [companies],
  );

  const visibleInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const company = invoice.company_id
          ? companyById.get(String(invoice.company_id))
          : null;
        return invoiceMatchesSearchQuery(
          invoice,
          company?.name ?? null,
          searchQuery,
        );
      }),
    [companyById, invoices, searchQuery],
  );

  if (isPending) {
    return <ListSkeleton rows={8} />;
  }

  if (!invoices.length) {
    return (
      <EmptyState
        icon={<Mail className="size-8 text-muted-foreground" />}
        title="No invoices yet"
        description="Create an invoice to send a payment request."
      />
    );
  }

  if (!visibleInvoices.length) {
    return (
      <EmptyState
        title="No matching invoices"
        description="Try a different search."
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead className="w-[24%]">Customer</TableHead>
            <TableHead className="w-[12%]">Invoice #</TableHead>
            <TableHead className="w-[10%]">Issue date</TableHead>
            <TableHead className="w-[10%]">Due date</TableHead>
            <TableHead className="w-[16%]">Status</TableHead>
            <TableHead className="w-[11%] text-right">Total</TableHead>
            <TableHead className="w-[11%] text-right">Balance</TableHead>
            <TableHead className="w-[6%]" aria-label="Sent" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleInvoices.map((invoice) => {
            const company = invoice.company_id
              ? companyById.get(String(invoice.company_id))
              : null;
            const isSelected = String(invoice.id) === String(selectedInvoiceId);
            const { total, balance, isPartial } = invoiceListTotals(invoice);
            const statusLabel = invoiceStatusSidebarLabel(
              invoice.status,
              invoice.due_date,
              { isPartial },
            );
            return (
              <TableRow
                key={String(invoice.id)}
                data-state={isSelected ? "selected" : undefined}
                onClick={() => onSelectInvoice(String(invoice.id))}
                className={cn("cursor-pointer", isSelected && "bg-primary/5")}
              >
                <TableCell className="font-medium">
                  {company?.name ?? (
                    <span className="text-muted-foreground">No customer</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {invoice.invoice_number ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {invoice.issue_date
                    ? formatBillingDate(invoice.issue_date)
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {invoice.due_date ? formatBillingDate(invoice.due_date) : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={invoiceStatusSidebarVariant(
                      invoice.status,
                      invoice.due_date,
                    )}
                    className="text-[10px] uppercase tracking-wide"
                  >
                    {statusLabel}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  <MoneyText value={total} />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  <MoneyText value={balance} />
                </TableCell>
                <TableCell>
                  {invoice.sent_at ? (
                    <Mail
                      className="size-3.5 text-muted-foreground"
                      aria-label="Sent"
                    />
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
