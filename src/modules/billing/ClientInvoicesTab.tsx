import { useMemo, useState } from "react";
import { useRefresh } from "ra-core";
import { useLocation, useSearchParams } from "react-router";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { CreateClientInvoiceDialog } from "@/modules/billing/CreateClientInvoiceDialog";
import { InvoiceBillingWorkspace } from "@/modules/billing/InvoiceBillingWorkspace";
import {
  buildInvoiceListFilter,
  type InvoiceStatusFilter,
} from "@/modules/billing/billingDisplayUtils";
import { isBillingInvoiceWorkspace } from "@/modules/billing/billingWorkspaceMode";
import { cn } from "@/lib/utils";

const INVOICE_STATUS_PARAM_VALUES: InvoiceStatusFilter[] = [
  "all",
  "draft",
  "sent",
  "paid",
  "overdue",
  "void",
];

const resolveInvoiceStatusFromParams = (
  params: URLSearchParams,
): InvoiceStatusFilter => {
  const value = params.get("invoice_status");
  if (value && INVOICE_STATUS_PARAM_VALUES.includes(value as InvoiceStatusFilter)) {
    return value as InvoiceStatusFilter;
  }
  return "all";
};

export const ClientInvoicesTab = () => {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>(() =>
    resolveInvoiceStatusFromParams(searchParams),
  );
  const [fromProposalOpen, setFromProposalOpen] = useState(false);
  const location = useLocation();
  const refresh = useRefresh();
  const hasInvoiceOpen = isBillingInvoiceWorkspace(
    location.pathname,
    location.search,
  );

  const listFilter = useMemo(
    () => buildInvoiceListFilter(statusFilter),
    [statusFilter],
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        hasInvoiceOpen ? "h-full flex-1 gap-0 overflow-hidden" : "gap-3",
      )}
    >
      <List
        resource="client_invoices"
        title={false}
        disableBreadcrumb
        perPage={50}
        sort={{ field: "issue_date", order: "DESC" }}
        filter={listFilter}
        actions={false}
        contentScrollable={!hasInvoiceOpen}
        className={hasInvoiceOpen ? "min-h-0 flex-1" : undefined}
        pagination={
          hasInvoiceOpen ? (
            false
          ) : (
            <ListPagination rowsPerPageOptions={[25, 50, 100]} />
          )
        }
      >
        <InvoiceBillingWorkspace
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onFromProposal={() => setFromProposalOpen(true)}
          showSummaryCards={!hasInvoiceOpen}
        />
      </List>

      <CreateClientInvoiceDialog
        open={fromProposalOpen}
        onOpenChange={setFromProposalOpen}
        onCreated={refresh}
      />
    </div>
  );
};
