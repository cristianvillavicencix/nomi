import { useMemo, useState } from "react";
import { useRefresh } from "ra-core";
import { useLocation } from "react-router";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { CreateClientInvoiceDialog } from "@/modules/billing/CreateClientInvoiceDialog";
import { InvoiceBillingWorkspace } from "@/modules/billing/InvoiceBillingWorkspace";
import { type InvoiceStatusFilter } from "@/modules/billing/billingDisplayUtils";
import { isBillingInvoiceWorkspace } from "@/modules/billing/billingWorkspaceMode";
import { cn } from "@/lib/utils";

const buildInvoiceFilter = (statusFilter: InvoiceStatusFilter) => {
  if (statusFilter === "all") return {};
  if (statusFilter === "overdue") {
    return {
      "status@eq": "sent",
      "due_date@lt": new Date().toISOString().slice(0, 10),
    };
  }
  return { "status@eq": statusFilter };
};

export const ClientInvoicesTab = () => {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("all");
  const [fromProposalOpen, setFromProposalOpen] = useState(false);
  const location = useLocation();
  const refresh = useRefresh();
  const hasInvoiceOpen = isBillingInvoiceWorkspace(
    location.pathname,
    location.search,
  );

  const listFilter = useMemo(
    () => buildInvoiceFilter(statusFilter),
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
