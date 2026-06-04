import { useMemo, useState } from "react";
import {
  useGetIdentity,
  useGetList,
  useGetMany,
  useListContext,
} from "ra-core";
import { Link, useNavigate } from "react-router";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { LBS_PLACEHOLDER_MODULES } from "@/lbs/navigation";
import type { Proposal, ProposalPaymentInstallment } from "@/lbs/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { cn } from "@/lib/utils";

type StatusFilter =
  | "all"
  | "pending"
  | "paid"
  | "overdue"
  | "failed"
  | "requires_action";

const todayIso = () => new Date().toISOString().slice(0, 10);

const isOverdue = (row: ProposalPaymentInstallment) =>
  row.status === "pending" &&
  Boolean(row.due_date) &&
  row.due_date < todayIso();

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const statusLabel = (row: ProposalPaymentInstallment) => {
  if (isOverdue(row)) return "Overdue";
  switch (row.status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "requires_action":
      return "Action required";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    case "waived":
      return "Waived";
    default:
      return row.status ?? "—";
  }
};

const statusVariant = (row: ProposalPaymentInstallment) => {
  if (isOverdue(row)) return "destructive" as const;
  switch (row.status) {
    case "paid":
      return "default" as const;
    case "failed":
    case "requires_action":
      return "destructive" as const;
    case "processing":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "requires_action", label: "Action required" },
];

const buildListFilter = (statusFilter: StatusFilter) => {
  if (statusFilter === "all") return {};
  if (statusFilter === "overdue") {
    return {
      "status@eq": "pending",
      "due_date@lt": todayIso(),
    };
  }
  return { "status@eq": statusFilter };
};

export const ClientBillingList = () => {
  const { identity } = useGetIdentity();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const listFilter = useMemo(
    () => buildListFilter(statusFilter),
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
        if (isOverdue(row)) {
          overdueAmount += amount;
          overdueCount += 1;
        }
      }
    }

    return { collected, outstanding, overdueAmount, overdueCount };
  }, [allInstallments]);

  if (!identity) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <PageActions>
        <PageTitle label="Billing" />
        <div className="ml-auto">
          <ModuleInfoPopover
            title={LBS_PLACEHOLDER_MODULES.billing.title}
            description={LBS_PLACEHOLDER_MODULES.billing.description}
          />
        </div>
      </PageActions>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          title="Collected"
          subtitle="Paid installments"
          amount={summary.collected}
        />
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
        {FILTER_OPTIONS.map((option) => (
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
        sx={{ "& .RaList-main": { boxShadow: "none" } }}
      >
        <BillingInstallmentsTable />
      </List>
    </div>
  );
};

const BillingInstallmentsTable = () => {
  const navigate = useNavigate();
  const { data: installments = [], isPending } =
    useListContext<ProposalPaymentInstallment>();

  const proposalIds = useMemo(
    () =>
      [
        ...new Set(
          installments
            .map((row) => row.proposal_id)
            .filter((id): id is ProposalPaymentInstallment["proposal_id"] =>
              id != null,
            ),
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
          formatDate(record.due_date)
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
          <Badge variant={statusVariant(record)} className="capitalize">
            {statusLabel(record)}
          </Badge>
        )}
      />
      <DataTable.Col
        source="payment_method"
        label="Method"
        render={(record: ProposalPaymentInstallment) => (
          <span className="capitalize text-muted-foreground">
            {record.payment_method?.replace(/_/g, " ") ?? "—"}
          </span>
        )}
      />
      <DataTable.Col
        source="paid_at"
        label="Paid"
        render={(record: ProposalPaymentInstallment) =>
          record.paid_at ? formatDate(record.paid_at.slice(0, 10)) : "—"
        }
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
      variant === "warning" &&
        amount > 0 &&
        "border-amber-500/40 bg-amber-500/5",
    )}
  >
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </CardHeader>
    <CardContent>
      <p className="text-2xl font-semibold tabular-nums">
        <MoneyText value={amount} />
      </p>
    </CardContent>
  </Card>
);
