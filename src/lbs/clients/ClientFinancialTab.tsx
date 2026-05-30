import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useSearchParams } from "react-router";
import { useGetList } from "ra-core";
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
import type { Proposal } from "@/lbs/types";
import { ClientTabEmpty } from "@/lbs/clients/ClientContactsTab";
import {
  ClientContractsTab,
  ClientProposalsTab,
} from "@/lbs/clients/ClientTabPanels";
import {
  ClientTabAccordion,
  ClientTabAccordionSection,
} from "@/lbs/clients/ClientTabAccordion";
import {
  ClientTabContentCard,
  clientTableWrapperClassName,
} from "@/lbs/clients/ClientTabSectionCard";
import {
  FINANCIAL_SECTIONS,
  getValidFinancialSection,
  type FinancialSection,
} from "@/lbs/clients/clientShowUtils";
import { MoneyText } from "@/lib/permissions/MoneyText";

const TabLoading = () => (
  <div className="space-y-2">
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
);

type ClientFinancialTabProps = {
  companyId: Company["id"];
  counts: {
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
    <ClientTabAccordion value={openSections} onValueChange={handleAccordionChange}>
      <ClientTabAccordionSection value="summary" title="Summary">
        <ClientTabContentCard>
          <ClientFinancialSummary companyId={companyId} />
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
  const { data: deals = [], isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const dealIds = useMemo(() => deals.map((deal) => deal.id), [deals]);

  const paymentsFilter =
    dealIds.length > 0
      ? { "deal_id@in": `(${dealIds.join(",")})` }
      : { "deal_id@eq": -1 };

  const { data: payments = [], isPending: paymentsPending } =
    useGetList<DealClientPayment>(
      "deal_client_payments",
      {
        filter: paymentsFilter,
        pagination: { page: 1, perPage: 500 },
        sort: { field: "payment_date", order: "DESC" },
      },
      { staleTime: 30_000, enabled: dealIds.length > 0 },
    );

  const { data: proposals = [], isPending: proposalsPending } =
    useGetList<Proposal>(
      "proposals",
      {
        filter: { "company_id@eq": companyId },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "updated_at", order: "DESC" },
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

  if (dealsPending || paymentsPending || proposalsPending) {
    return <TabLoading />;
  }

  if (deals.length === 0 && proposals.length === 0) {
    return (
      <ClientTabEmpty message="No financial activity for this client yet. Use the + button to create a proposal or project." />
    );
  }

  const balance = totalContracted - totalCollected;

  return (
    <div className="space-y-4">
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
  const { data: deals = [], isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const dealIds = useMemo(() => deals.map((deal) => deal.id), [deals]);
  const dealsById = useMemo(
    () => Object.fromEntries(deals.map((deal) => [String(deal.id), deal])),
    [deals],
  );

  const paymentsFilter =
    dealIds.length > 0
      ? { "deal_id@in": `(${dealIds.join(",")})` }
      : { "deal_id@eq": -1 };

  const { data: payments = [], isPending: paymentsPending } =
    useGetList<DealClientPayment>(
      "deal_client_payments",
      {
        filter: paymentsFilter,
        pagination: { page: 1, perPage: 500 },
        sort: { field: "payment_date", order: "DESC" },
      },
      { staleTime: 30_000, enabled: dealIds.length > 0 },
    );

  if (dealsPending || paymentsPending) return <TabLoading />;

  if (dealIds.length === 0) {
    return (
      <ClientTabEmpty message="Create a project first to record client payments." />
    );
  }

  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No payments recorded yet. Log payments in each project&apos;s detail
        view.
      </p>
    );
  }

  return (
    <div className={clientTableWrapperClassName}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Project</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="hidden sm:table-cell">Method</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="text-muted-foreground">
                {payment.payment_date || "—"}
              </TableCell>
              <TableCell>
                {payment.deal_id ? (
                  <Link
                    to={`/deals/${payment.deal_id}/show`}
                    className="link-action font-medium"
                  >
                    {dealsById[String(payment.deal_id)]?.name ??
                      `Project #${payment.deal_id}`}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right font-medium">
                <MoneyText value={payment.amount} />
              </TableCell>
              <TableCell className="hidden capitalize text-muted-foreground sm:table-cell">
                {payment.payment_method?.replace(/_/g, " ") || "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {payment.status}
                </Badge>
              </TableCell>
              <TableCell className="hidden max-w-xs truncate text-muted-foreground lg:table-cell">
                {payment.reference_number ||
                  payment.check_number ||
                  payment.notes ||
                  "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
