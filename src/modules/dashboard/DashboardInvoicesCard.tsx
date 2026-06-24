import { useMemo } from "react";
import { Link } from "react-router";
import { FileText, Plus } from "lucide-react";
import { useGetList } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ClientInvoice } from "@/modules/types";
import {
  formatBillingDate,
  todayIso,
} from "@/modules/billing/billingDisplayUtils";
import { formatInvoiceMoney } from "@/modules/billing/invoiceEmailTemplate";
import { DashboardModuleCard } from "@/modules/dashboard/DashboardModuleCard";

const isInvoiceOverdue = (invoice: ClientInvoice) =>
  invoice.status === "sent" &&
  Boolean(invoice.due_date) &&
  invoice.due_date < todayIso();

export const DashboardInvoicesCard = () => {
  const { data: invoices = [], isPending } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      filter: { "status@eq": "sent" },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "due_date", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const overdue = useMemo(
    () => invoices.filter(isInvoiceOverdue).length,
    [invoices],
  );

  const totalUnpaid = useMemo(
    () =>
      invoices.reduce(
        (sum, invoice) => sum + (Number(invoice.amount) || 0),
        0,
      ),
    [invoices],
  );

  const preview = useMemo(
    () =>
      [...invoices]
        .sort((left, right) => {
          const leftOverdue = isInvoiceOverdue(left) ? 0 : 1;
          const rightOverdue = isInvoiceOverdue(right) ? 0 : 1;
          if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;
          return (
            new Date(left.due_date).getTime() - new Date(right.due_date).getTime()
          );
        })
        .slice(0, 5),
    [invoices],
  );

  const badges = [
    {
      label: `${invoices.length} unpaid · ${formatInvoiceMoney(totalUnpaid)}`,
    },
    ...(overdue > 0
      ? [{ label: `${overdue} overdue`, tone: "danger" as const }]
      : []),
  ];

  return (
    <DashboardModuleCard
      icon={FileText}
      title="Invoices"
      badges={badges}
      isPending={isPending}
      emptyMessage="No unpaid invoices."
      viewAllHref="/billing"
      viewAllLabel="View all invoices"
      addAction={
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="p-2"
                asChild
              >
                <Link to="/billing/invoices/new">
                  <Plus className="size-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>New invoice</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
    >
      {preview.length === 0 ? (
        <p className="text-sm text-muted-foreground">No unpaid invoices.</p>
      ) : (
        <ul className="space-y-2">
          {preview.map((invoice) => {
            const overdueInvoice = isInvoiceOverdue(invoice);
            const dueLabel = formatBillingDate(invoice.due_date);

            return (
              <li
                key={String(invoice.id)}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/billing/invoices/${invoice.id}/show`}
                    className="block truncate font-medium link-action"
                  >
                    {invoice.invoice_number?.trim() ||
                      invoice.description?.trim() ||
                      `Invoice #${invoice.id}`}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatInvoiceMoney(
                      Number(invoice.amount) || 0,
                      invoice.currency ?? "USD",
                    )}
                  </p>
                </div>
                {dueLabel ? (
                  <span
                    className={
                      overdueInvoice
                        ? "shrink-0 text-xs font-medium text-red-600"
                        : "shrink-0 text-xs text-muted-foreground"
                    }
                  >
                    {dueLabel}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardModuleCard>
  );
};
