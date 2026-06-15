import { useMemo, useState } from "react";
import { useRefresh } from "ra-core";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { CreateClientInvoiceDialog } from "@/modules/billing/CreateClientInvoiceDialog";
import { InvoiceBillingWorkspace } from "@/modules/billing/InvoiceBillingWorkspace";
import { type InvoiceStatusFilter } from "@/modules/billing/billingDisplayUtils";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

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
  const refresh = useRefresh();

  const listFilter = useMemo(
    () => buildInvoiceFilter(statusFilter),
    [statusFilter],
  );

  const createMenuItems = (
    <>
      <DropdownMenuItem asChild>
        <Link to="/billing/invoices/new" className="flex items-center gap-2">
          <Plus className="size-4" />
          New invoice
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setFromProposalOpen(true)}>
        <Plus className="size-4" />
        From proposal
      </DropdownMenuItem>
    </>
  );

  return (
    <>
      <List
        resource="client_invoices"
        title={false}
        disableBreadcrumb
        perPage={50}
        sort={{ field: "issue_date", order: "DESC" }}
        filter={listFilter}
        actions={false}
        pagination={<ListPagination rowsPerPageOptions={[25, 50, 100]} />}
      >
        <InvoiceBillingWorkspace
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          createMenuItems={createMenuItems}
        />
      </List>

      <CreateClientInvoiceDialog
        open={fromProposalOpen}
        onOpenChange={setFromProposalOpen}
        onCreated={refresh}
      />
    </>
  );
};
