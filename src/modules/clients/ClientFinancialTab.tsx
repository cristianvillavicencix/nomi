import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useSearchParams } from "react-router";
import { useGetList, useGetOne } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  Company,
  Deal,
  DealClientPayment,
} from "@/components/atomic-crm/types";
import type { Proposal } from "@/modules/types";
import type { ClientInvoice } from "@/modules/types";
import { ClientTabEmpty } from "@/modules/clients/ClientContactsTab";
import {
  ClientContractsTab,
  ClientInvoicesTab,
  ClientProposalsTab,
} from "@/modules/clients/ClientTabPanels";
import {
  ClientTabAccordion,
  ClientTabAccordionSection,
} from "@/modules/clients/ClientTabAccordion";
import {
  ClientTabContentCard,
  clientTableWrapperClassName,
} from "@/modules/clients/ClientTabSectionCard";
import {
  FINANCIAL_SECTIONS,
  getValidFinancialSection,
  type FinancialSection,
} from "@/modules/clients/clientShowUtils";
import { MoneyText } from "@/lib/permissions/MoneyText";
import {
  buildInvoicePaymentRows,
  buildProjectPaymentRows,
  mergeClientFinancialPaymentRows,
} from "@/modules/clients/clientFinancialPayments";

const TabLoading = () => (
  <div className="space-y-2">
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
);

type ClientFinancialTabProps = {
  companyId: Company["id"];
  counts: {
    invoices: number;
    proposals: number;
    contracts: number;
    payments: number;
  };
  syncUrl?: boolean;
};

export const ClientFinancialTab = ({
  companyId,
  counts,
  syncUrl = true,
}: ClientFinancialTabProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl =
    syncUrl && searchParams.get("tab") === "financial"
      ? getValidFinancialSection(searchParams.get("section"))
      : "summary";

  const [openSections, setOpenSections] = useState<string[]>(() => [
    sectionFromUrl,
  ]);

  useEffect(() => {
    if (!syncUrl) return;
    if (searchParams.get("tab") !== "financial") return;
    setOpenSections([getValidFinancialSection(searchParams.get("section"))]);
  }, [syncUrl, searchParams.get("tab"), searchParams.get("section")]);

  const handleAccordionChange = (values: string[]) => {
    setOpenSections(values);
    if (!syncUrl) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", "financial");
    const primary = values[0] as FinancialSection | undefined;
    if (!primary || primary === "summary") {
      next.delete("section");
    } else if (FINANCIAL_SECTIONS.includes(primary)) {
      next.set("section", primary);
    }
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!syncUrl) return;
    const tab = searchParams.get("tab");
    if (tab !== "financial") return;
    const rawSection = searchParams.get("section");
    if (
      rawSection &&
      !FINANCIAL_SECTIONS.includes(rawSection as FinancialSection)
    ) {
      const next = new URLSearchParams(searchParams);
      next.delete("section");
      setSearchParams(next, { replace: true });
    }
  }, [syncUrl, searchParams, setSearchParams]);

  return (
    <ClientTabAccordion
      value={openSections}
      onValueChange={handleAccordionChange}
    >
      <ClientTabAccordionSection value="summary" title="Summary">
        <ClientTabContentCard>
          <ClientFinancialSummary companyId={companyId} />
        </ClientTabContentCard>
      </ClientTabAccordionSection>

      <ClientTabAccordionSection
        value="invoices"
        title="Invoices"
        count={counts.invoices}
      >
        <ClientTabContentCard flush>
          <ClientInvoicesTab companyId={companyId} />
        </ClientTabContentCard>
      </ClientTabAccordionSection>

      <ClientTabAccordionSection
        value="proposals"
        title="Proposals"
        count={counts.proposals}
      >
        <ClientTabContentCard flush>
          <ClientProposalsTab companyId={companyId} />
        </ClientTabContentCard>
      </ClientTabAccordionSection>

      <ClientTabAccordionSection
        value="contracts"
        title="Contracts"
        count={counts.contracts}
      >
        <ClientTabContentCard flush>
          <ClientContractsTab companyId={companyId} />
        </ClientTabContentCard>
      </ClientTabAccordionSection>

      <ClientTabAccordionSection
        value="payments"
        title="Payments"
        count={counts.payments}
      >
        <ClientTabContentCard flush>
          <ClientPaymentsSection companyId={companyId} />
        </ClientTabContentCard>
      </ClientTabAccordionSection>
    </ClientTabAccordion>
  );
};

const ClientFinancialSummary = ({
  companyId,
}: {
  companyId: Company["id"];
}) => {
  const { data: deals = [], isLoading: dealsLoading } = useGetList<Deal>(
    "deals",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const dealIds = useMemo(() => deals.map((deal) => deal.id), [deals]);
  const paymentsEnabled = dealIds.length > 0;

  const paymentsFilter = paymentsEnabled
    ? { "deal_id@in": `(${dealIds.join(",")})` }
    : { "deal_id@eq": -1 };

  const { data: payments = [], isLoading: paymentsLoading } =
    useGetList<DealClientPayment>(
      "deal_client_payments",
      {
        filter: paymentsFilter,
        pagination: { page: 1, perPage: 500 },
        sort: { field: "payment_date", order: "DESC" },
      },
      { staleTime: 30_000, enabled: paymentsEnabled },
    );

  const { data: proposals = [], isLoading: proposalsLoading } =
    useGetList<Proposal>(
      "proposals",
      {
        filter: { "company_id@eq": companyId },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "updated_at", order: "DESC" },
      },
      { staleTime: 30_000 },
    );

  const { data: invoices = [], isLoading: invoicesLoading } =
    useGetList<ClientInvoice>(
      "client_invoices",
      {
        filter: { "company_id@eq": companyId },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "issue_date", order: "DESC" },
      },
      { staleTime: 30_000 },
    );

  const totalContracted = useMemo(
    () => deals.reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0),
    [deals],
  );

  const totalCollected = useMemo(
    () =>
      payments
        .filter(
          (payment) =>
            payment.status === "cleared" || payment.status === "deposited",
        )
        .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [payments],
  );

  const totalPending = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === "pending")
        .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [payments],
  );

  const openProposals = useMemo(
    () =>
      proposals.filter(
        (proposal) =>
          proposal.status &&
          !["accepted", "declined", "expired"].includes(proposal.status),
      ),
    [proposals],
  );

  const activeInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status !== "void"),
    [invoices],
  );

  const totalInvoiced = useMemo(
    () =>
      activeInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.amount ?? 0),
        0,
      ),
    [activeInvoices],
  );

  const totalInvoicePaid = useMemo(
    () =>
      activeInvoices.reduce((sum, invoice) => {
        if (invoice.status === "paid") {
          return sum + Number(invoice.amount_paid ?? invoice.amount ?? 0);
        }
        return sum + Number(invoice.amount_paid ?? 0);
      }, 0),
    [activeInvoices],
  );

  const invoiceOutstanding = totalInvoiced - totalInvoicePaid;

  if (dealsLoading || paymentsLoading || proposalsLoading || invoicesLoading) {
    return <TabLoading />;
  }

  if (
    deals.length === 0 &&
    proposals.length === 0 &&
    activeInvoices.length === 0
  ) {
    return (
      <ClientTabEmpty message="No financial activity for this client yet. Ticket invoices, proposals, and project payments appear here once created." />
    );
  }

  const balance = totalContracted - totalCollected;
  const showProjectSummary = deals.length > 0;
  const showInvoiceSummary = activeInvoices.length > 0;

  return (
    <div className="space-y-4">
      {showProjectSummary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Contracted"
            value={<MoneyText value={totalContracted} />}
          />
          <SummaryCard
            label="Collected"
            value={<MoneyText value={totalCollected} />}
          />
          <SummaryCard
            label="Pending payments"
            value={<MoneyText value={totalPending} />}
          />
          <SummaryCard label="Balance" value={<MoneyText value={balance} />} />
        </div>
      ) : null}
      {showInvoiceSummary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            label="Invoiced"
            value={<MoneyText value={totalInvoiced} />}
          />
          <SummaryCard
            label="Paid"
            value={<MoneyText value={totalInvoicePaid} />}
          />
          <SummaryCard
            label="Outstanding"
            value={<MoneyText value={invoiceOutstanding} />}
          />
        </div>
      ) : null}
      {openProposals.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {openProposals.length} open proposal
          {openProposals.length === 1 ? "" : "s"} awaiting response.
        </p>
      ) : null}
    </div>
  );
};

const ClientPaymentsSection = ({ companyId }: { companyId: Company["id"] }) => {
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId },
    { staleTime: 60_000 },
  );

  const { data: deals = [], isLoading: dealsLoading } = useGetList<Deal>(
    "deals",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const { data: invoices = [], isLoading: invoicesLoading } =
    useGetList<ClientInvoice>(
      "client_invoices",
      {
        filter: { "company_id@eq": companyId },
        pagination: { page: 1, perPage: 200 },
        sort: { field: "paid_at", order: "DESC" },
      },
      { staleTime: 30_000 },
    );

  const dealIds = useMemo(() => deals.map((deal) => deal.id), [deals]);
  const dealsById = useMemo(
    () => Object.fromEntries(deals.map((deal) => [String(deal.id), deal])),
    [deals],
  );

  const paymentsEnabled = dealIds.length > 0;
  const paymentsFilter = paymentsEnabled
    ? { "deal_id@in": `(${dealIds.join(",")})` }
    : { "deal_id@eq": -1 };

  const { data: projectPayments = [], isLoading: projectPaymentsLoading } =
    useGetList<DealClientPayment>(
      "deal_client_payments",
      {
        filter: paymentsFilter,
        pagination: { page: 1, perPage: 500 },
        sort: { field: "payment_date", order: "DESC" },
      },
      { staleTime: 30_000, enabled: paymentsEnabled },
    );

  const payerLabel = company?.name?.trim() || "Client";
  const paymentRows = useMemo(
    () =>
      mergeClientFinancialPaymentRows(
        buildInvoicePaymentRows(invoices, payerLabel),
        buildProjectPaymentRows(projectPayments, dealsById, payerLabel),
      ),
    [dealsById, invoices, payerLabel, projectPayments],
  );

  if (dealsLoading || invoicesLoading || projectPaymentsLoading) {
    return <TabLoading />;
  }

  if (paymentRows.length === 0) {
    return (
      <ClientTabEmpty message="No payments recorded yet. Stripe invoice payments and project payments appear here once collected." />
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Payment received
      </h4>
      <div className={clientTableWrapperClassName}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="hidden md:table-cell">Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">
                Payment mode
              </TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">
                  {row.dateLabel}
                </TableCell>
                <TableCell className="font-medium">{row.payerLabel}</TableCell>
                <TableCell>
                  {row.invoiceId ? (
                    <div className="space-y-0.5">
                      <Link
                        to={`/billing/invoices/${row.invoiceId}/show`}
                        className="link-action font-medium"
                      >
                        {row.invoiceNumber ?? `Invoice #${row.invoiceId}`}
                      </Link>
                      {row.ticketId ? (
                        <div className="text-xs text-muted-foreground">
                          <Link
                            to={`/tickets/${row.ticketId}/show`}
                            className="link-action"
                          >
                            Ticket #{row.ticketId}
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ) : row.dealId ? (
                    <Link
                      to={`/deals/${row.dealId}/show`}
                      className="link-action font-medium"
                    >
                      {row.dealName ?? `Project #${row.dealId}`}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="hidden max-w-[10rem] truncate text-muted-foreground md:table-cell">
                  {row.reference}
                </TableCell>
                <TableCell>
                  <Badge variant={row.statusVariant} className="capitalize">
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden capitalize text-muted-foreground sm:table-cell">
                  {row.paymentMode}
                </TableCell>
                <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-400">
                  <MoneyText value={row.amount} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value }: { label: string; value: ReactNode }) => (
  <Card className="shadow-none">
    <CardContent className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </CardContent>
  </Card>
);
