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
import { useIsMobile } from "@/hooks/use-mobile";
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
  if (
    value &&
    INVOICE_STATUS_PARAM_VALUES.includes(value as InvoiceStatusFilter)
  ) {
    return value as InvoiceStatusFilter;
  }
  return "all";
};

export const ClientInvoicesTab = () => {
  const isMobile = useIsMobile();
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
  const fillHeight = isMobile || hasInvoiceOpen;

  const listFilter = useMemo(
    () => buildInvoiceListFilter(statusFilter),
    [statusFilter],
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        fillHeight ? "h-full gap-0" : "gap-3",
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
        contentScrollable={!fillHeight}
        className={fillHeight ? "min-h-0 flex-1" : undefined}
        pagination={
          fillHeight ? (
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
          showSummaryCards={!hasInvoiceOpen && !isMobile}
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
