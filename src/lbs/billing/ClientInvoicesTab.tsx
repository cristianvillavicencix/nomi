import { useMemo, useState } from "react";
import { useRefresh } from "ra-core";
import { Link } from "react-router";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { CreateClientInvoiceButton } from "@/lbs/billing/CreateClientInvoiceDialog";
import { InvoiceBillingWorkspace } from "@/lbs/billing/InvoiceBillingWorkspace";
import { Plus } from "lucide-react";
import {
  INVOICE_FILTER_OPTIONS,
  type InvoiceStatusFilter,
} from "@/lbs/billing/billingDisplayUtils";
import { Button } from "@/components/ui/button";

const buildInvoiceFilter = (statusFilter: InvoiceStatusFilter) => {
  if (statusFilter === "all") return {};
  if (statusFilter === "overdue") {
    return { "status@eq": "sent", "due_date@lt": new Date().toISOString().slice(0, 10) };
  }
  return { "status@eq": statusFilter };
};

export const ClientInvoicesTab = () => {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("all");
  const refresh = useRefresh();
  const listFilter = useMemo(
    () => buildInvoiceFilter(statusFilter),
    [statusFilter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {INVOICE_FILTER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={statusFilter === option.value ? "default" : "outline"}
              onClick={() => setStatusFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" asChild>
            <Link to="/billing/invoices/new">
              <Plus className="size-4" />
              New invoice
            </Link>
          </Button>
          <CreateClientInvoiceButton onCreated={refresh} />
        </div>
      </div>

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
        <InvoiceBillingWorkspace />
      </List>
    </div>
  );
};
