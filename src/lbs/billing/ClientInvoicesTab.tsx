import { useMemo, useState } from "react";
import {
  useGetList,
  useGetMany,
  useListContext,
  useRefresh,
} from "ra-core";
import { Link, useNavigate } from "react-router";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { InvoiceRowActions } from "@/lbs/billing/SendInvoiceDialog";
import { CreateClientInvoiceButton } from "@/lbs/billing/CreateClientInvoiceDialog";
import { Plus } from "lucide-react";
import {
  formatBillingDate,
  INVOICE_FILTER_OPTIONS,
  invoiceStatusLabel,
  invoiceStatusVariant,
  type InvoiceStatusFilter,
} from "@/lbs/billing/billingDisplayUtils";
import type { ClientInvoice, Proposal } from "@/lbs/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/lib/permissions/MoneyText";

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
        <ClientInvoicesTable />
      </List>
    </div>
  );
};

const ClientInvoicesTable = () => {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { title: organizationName = "LBS" } = useConfigurationContext();
  const { data: invoices = [], isPending } = useListContext<ClientInvoice>();

  const companyIds = useMemo(
    () =>
      [
        ...new Set(
          invoices
            .map((row) => row.company_id)
            .filter((id): id is NonNullable<ClientInvoice["company_id"]> => id != null),
        ),
      ],
    [invoices],
  );
  const contactIds = useMemo(
    () =>
      [
        ...new Set(
          invoices
            .map((row) => row.contact_id)
            .filter((id): id is NonNullable<ClientInvoice["contact_id"]> => id != null),
        ),
      ],
    [invoices],
  );
  const proposalIds = useMemo(
    () =>
      [
        ...new Set(
          invoices
            .map((row) => row.proposal_id)
            .filter((id): id is NonNullable<ClientInvoice["proposal_id"]> => id != null),
        ),
      ],
    [invoices],
  );

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );
  const { data: proposals = [] } = useGetMany<Proposal>(
    "proposals",
    { ids: proposalIds },
    { enabled: proposalIds.length > 0 },
  );

  const companyById = useMemo(
    () => new Map(companies.map((c) => [String(c.id), c])),
    [companies],
  );
  const contactById = useMemo(
    () => new Map(contacts.map((c) => [String(c.id), c])),
    [contacts],
  );
  const proposalById = useMemo(
    () => new Map(proposals.map((p) => [String(p.id), p])),
    [proposals],
  );

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!invoices.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No invoices yet. Create one from a proposal or issue from Collections.
      </p>
    );
  }

  return (
    <DataTable
      rowClick={(rowId) => {
        navigate(`/billing/invoices/${rowId}/edit`);
      }}
      rowClassName={() => "[&_td]:py-2.5"}
    >
      <DataTable.Col
        source="invoice_number"
        label="Invoice #"
        render={(record: ClientInvoice) => (
          <span className="font-medium text-blue-700">{record.invoice_number}</span>
        )}
      />
      <DataTable.Col
        source="issue_date"
        label="Issued"
        render={(record: ClientInvoice) => formatBillingDate(record.issue_date)}
      />
      <DataTable.Col
        source="due_date"
        label="Due"
        render={(record: ClientInvoice) => formatBillingDate(record.due_date)}
      />
      <DataTable.Col
        label="Client"
        render={(record: ClientInvoice) => {
          const company = record.company_id
            ? companyById.get(String(record.company_id))
            : null;
          return company?.name ?? "—";
        }}
      />
      <DataTable.Col
        label="Proposal"
        render={(record: ClientInvoice) => {
          const proposal = record.proposal_id
            ? proposalById.get(String(record.proposal_id))
            : null;
          if (!proposal) return "—";
          return proposal.proposal_number
            ? `#${proposal.proposal_number}`
            : proposal.title;
        }}
      />
      <DataTable.Col source="description" label="Description" />
      <DataTable.Col
        source="amount"
        label="Amount"
        render={(record: ClientInvoice) => <MoneyText value={record.amount} />}
      />
      <DataTable.Col
        source="status"
        label="Status"
        render={(record: ClientInvoice) => (
          <Badge
            variant={invoiceStatusVariant(record.status, record.due_date)}
            className="capitalize"
          >
            {invoiceStatusLabel(record.status, record.due_date)}
          </Badge>
        )}
      />
      <DataTable.Col
        label=""
        render={(record: ClientInvoice) => {
          const company = record.company_id
            ? companyById.get(String(record.company_id))
            : null;
          const contact = record.contact_id
            ? contactById.get(String(record.contact_id))
            : null;
          return (
            <div onClick={(event) => event.stopPropagation()} role="presentation">
              <InvoiceRowActions
                invoice={record}
                organizationName={organizationName}
                company={company}
                contact={contact}
                onRefresh={refresh}
              />
            </div>
          );
        }}
      />
    </DataTable>
  );
};
