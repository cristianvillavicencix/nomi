import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  useDataProvider,
  useGetList,
  useGetMany,
  useListContext,
  useNotify,
  useRefresh,
} from "ra-core";
import { Link, useNavigate } from "react-router";
import { Loader2, Receipt } from "lucide-react";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import type { ClientInvoice, Proposal, ProposalPaymentInstallment } from "@/lbs/types";
import {
  buildInstallmentListFilter,
  formatBillingDate,
  INSTALLMENT_FILTER_OPTIONS,
  installmentStatusLabel,
  installmentStatusVariant,
  isInstallmentOverdue,
  type InstallmentStatusFilter,
} from "@/lbs/billing/billingDisplayUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { cn } from "@/lib/utils";

export const BillingCollectionsTab = () => {
  const [statusFilter, setStatusFilter] = useState<InstallmentStatusFilter>("all");
  const listFilter = useMemo(
    () => buildInstallmentListFilter(statusFilter),
    [statusFilter],
  );

  const { data: allInstallments = [] } =
    useGetList<ProposalPaymentInstallment>("proposal_payment_installments", {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "due_date", order: "ASC" },
    });

  const summary = useMemo(() => {
    let collected = 0;
    let outstanding = 0;
    let overdueAmount = 0;
    let overdueCount = 0;

    for (const row of allInstallments) {
      const amount = Number(row.amount) || 0;
      if (row.status === "paid") {
        collected += amount;
      } else if (
        row.status === "pending" ||
        row.status === "processing" ||
        row.status === "failed" ||
        row.status === "requires_action"
      ) {
        outstanding += amount;
        if (isInstallmentOverdue(row)) {
          overdueAmount += amount;
          overdueCount += 1;
        }
      }
    }

    return { collected, outstanding, overdueAmount, overdueCount };
  }, [allInstallments]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard title="Collected" subtitle="Paid installments" amount={summary.collected} />
        <SummaryCard
          title="Outstanding"
          subtitle="Pending & failed"
          amount={summary.outstanding}
        />
        <SummaryCard
          title="Overdue"
          subtitle={
            summary.overdueCount > 0
              ? `${summary.overdueCount} installment${summary.overdueCount === 1 ? "" : "s"}`
              : "Nothing overdue"
          }
          amount={summary.overdueAmount}
          variant={summary.overdueCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {INSTALLMENT_FILTER_OPTIONS.map((option) => (
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

      <List
        resource="proposal_payment_installments"
        title={false}
        disableBreadcrumb
        perPage={50}
        sort={{ field: "due_date", order: "ASC" }}
        filter={listFilter}
        actions={false}
        pagination={<ListPagination rowsPerPageOptions={[25, 50, 100]} />}
      >
        <BillingInstallmentsTable />
      </List>
    </div>
  );
};

const BillingInstallmentsTable = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const canIssue = useMemberCapability("proposals.send");
  const { data: installments = [], isPending } =
    useListContext<ProposalPaymentInstallment>();

  const { data: issuedInvoices = [] } = useGetList<ClientInvoice>("client_invoices", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "created_at", order: "DESC" },
  });

  const issuedByInstallment = useMemo(
    () =>
      new Set(
        issuedInvoices
          .map((row) => row.installment_id)
          .filter(Boolean)
          .map(String),
      ),
    [issuedInvoices],
  );

  const proposalIds = useMemo(
    () =>
      [
        ...new Set(
          installments
            .map((row) => row.proposal_id)
            .filter((id): id is ProposalPaymentInstallment["proposal_id"] => id != null),
        ),
      ],
    [installments],
  );

  const { data: proposals = [] } = useGetMany<Proposal>(
    "proposals",
    { ids: proposalIds },
    { enabled: proposalIds.length > 0 },
  );

  const companyIds = useMemo(
    () =>
      [
        ...new Set(
          proposals
            .map((p) => p.company_id)
            .filter((id): id is NonNullable<Proposal["company_id"]> => id != null),
        ),
      ],
    [proposals],
  );

  const { data: companies = [] } = useGetMany<{ id: number; name: string }>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );

  const proposalById = useMemo(
    () => new Map(proposals.map((p) => [String(p.id), p])),
    [proposals],
  );
  const companyById = useMemo(
    () => new Map(companies.map((c) => [String(c.id), c])),
    [companies],
  );

  const issueMutation = useMutation({
    mutationFn: (installmentId: number) =>
      dataProvider.issueClientInvoice({ installmentId }),
    onSuccess: () => {
      notify("Invoice created", { type: "success" });
      refresh();
    },
    onError: (error: Error) =>
      notify(error.message || "Could not create invoice", { type: "error" }),
  });

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!installments.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No installments match this filter. Schedule payments on a{" "}
        <Link to="/proposals" className="link-action">
          proposal
        </Link>{" "}
        to see them here.
      </p>
    );
  }

  return (
    <DataTable
      rowClick={(id) => {
        const row = installments.find((r) => String(r.id) === String(id));
        const proposalId = row?.proposal_id;
        if (proposalId) navigate(`/proposals/${proposalId}/show`);
      }}
      rowClassName={() => "[&_td]:py-2.5"}
    >
      <DataTable.Col
        source="due_date"
        label="Due"
        render={(record: ProposalPaymentInstallment) =>
          formatBillingDate(record.due_date)
        }
      />
      <DataTable.Col
        label="Client"
        render={(record: ProposalPaymentInstallment) => {
          const proposal = proposalById.get(String(record.proposal_id));
          const company = proposal?.company_id
            ? companyById.get(String(proposal.company_id))
            : null;
          return company?.name ?? "—";
        }}
      />
      <DataTable.Col
        label="Proposal"
        render={(record: ProposalPaymentInstallment) => {
          const proposal = proposalById.get(String(record.proposal_id));
          if (!proposal) return "—";
          return proposal.proposal_number
            ? `#${proposal.proposal_number}`
            : proposal.title;
        }}
      />
      <DataTable.Col source="label" label="Installment" />
      <DataTable.Col
        source="amount"
        label="Amount"
        render={(record: ProposalPaymentInstallment) => (
          <MoneyText value={record.amount} />
        )}
      />
      <DataTable.Col
        source="status"
        label="Status"
        render={(record: ProposalPaymentInstallment) => (
          <Badge variant={installmentStatusVariant(record)} className="capitalize">
            {installmentStatusLabel(record)}
          </Badge>
        )}
      />
      <DataTable.Col
        label="Invoice"
        render={(record: ProposalPaymentInstallment) => {
          const hasInvoice = issuedByInstallment.has(String(record.id));
          if (hasInvoice) {
            return (
              <Badge variant="outline" className="font-normal">
                Issued
              </Badge>
            );
          }
          if (!canIssue) return "—";
          return (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={issueMutation.isPending}
              onClick={(event) => {
                event.stopPropagation();
                issueMutation.mutate(Number(record.id));
              }}
            >
              {issueMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Receipt className="size-3.5" />
              )}
              Issue
            </Button>
          );
        }}
      />
    </DataTable>
  );
};

const SummaryCard = ({
  title,
  subtitle,
  amount,
  variant = "default",
}: {
  title: string;
  subtitle: string;
  amount: number;
  variant?: "default" | "warning";
}) => (
  <Card
    className={cn(
      variant === "warning" && amount > 0 && "border-amber-500/40 bg-amber-500/5",
    )}
  >
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </CardHeader>
    <CardContent>
      <p className="text-2xl font-semibold tabular-nums">
        <MoneyText value={amount} />
      </p>
    </CardContent>
  </Card>
);
