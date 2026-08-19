import { Mail } from "lucide-react";
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
import { cn } from "@/lib/utils";

type InvoiceListSidebarProps = {
  selectedInvoiceId?: string | null;
  onSelectInvoice: (invoiceId: string) => void;
  searchQuery?: string;
};

export const InvoiceListSidebar = ({
  selectedInvoiceId,
  onSelectInvoice,
  searchQuery = "",
}: InvoiceListSidebarProps) => {
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
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading invoices…</div>
    );
  }

  if (!invoices.length) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No invoices yet.
      </div>
    );
  }

  if (!visibleInvoices.length) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No invoices match this search.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <ul className="divide-y">
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
            <li key={String(invoice.id)}>
              <button
                type="button"
                onClick={() => onSelectInvoice(String(invoice.id))}
                className={cn(
                  "flex w-full flex-col gap-1.5 px-3 py-3 text-left transition-colors hover:bg-muted/40",
                  isSelected &&
                    "bg-primary/5 ring-1 ring-inset ring-primary/20",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {company?.name ?? "No customer"}
                  </span>
                  <span className="shrink-0 text-right text-sm font-medium tabular-nums">
                    <MoneyText value={isPartial ? balance : total} />
                    {isPartial ? (
                      <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                        of <MoneyText value={total} />
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {invoice.invoice_number}
                    {invoice.issue_date
                      ? ` · ${formatBillingDate(invoice.issue_date)}`
                      : ""}
                  </span>
                  {invoice.sent_at ? (
                    <Mail
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-label="Sent"
                    />
                  ) : null}
                </div>
                <Badge
                  variant={invoiceStatusSidebarVariant(
                    invoice.status,
                    invoice.due_date,
                  )}
                  className="w-fit text-[10px] uppercase tracking-wide"
                >
                  {statusLabel}
                </Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
