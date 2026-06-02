import { useGetList, useGetOne } from "ra-core";
import { useMemo } from "react";
import type { Company, Contact, Deal, OrganizationMember } from "@/components/atomic-crm/types";
import {
  generatePaymentInstallments,
  lineTotal,
} from "@/lbs/proposals/proposalCommercialUtils";
import type {
  Contract,
  Proposal,
  ProposalLineItem,
  ProposalPaymentInstallment,
  ProposalPaymentSchedule,
  OrganizationContractTerms,
} from "@/lbs/types";
import { isPackageLine } from "@/lbs/proposals/proposalCatalogUtils";
import type { ProposalDocumentDataSnapshot } from "@/lbs/proposals/document/mapPublicProposalDocumentData";
import type { ProposalLineDraft } from "@/lbs/proposals/proposalCommercialUtils";

export type UseProposalDocumentDataOptions = {
  enabled?: boolean;
  fetchLinkedContract?: boolean;
  fetchContractTerms?: boolean;
};

export const buildCrmDocumentSnapshot = ({
  proposal,
  lineDrafts,
  lines,
  paymentInstallments,
  oneTimeTotal,
  currency,
  company,
  contact,
  deal,
  member,
  contractTerms,
}: {
  proposal: Proposal;
  lineDrafts: ProposalLineDraft[];
  lines: ProposalLineItem[];
  paymentInstallments: ProposalPaymentInstallment[];
  oneTimeTotal: number;
  currency: string;
  company?: Company | null;
  contact?: Contact | null;
  deal?: Deal | null;
  member?: OrganizationMember | null;
  contractTerms?: OrganizationContractTerms | null;
}): ProposalDocumentDataSnapshot => {
  const recurringSubtotal = lineDrafts
    .filter((line) => line.billing_type === "recurring")
    .reduce((sum, line) => sum + lineTotal(line.quantity, line.unit_price), 0);

  return {
    proposal,
    lineDrafts,
    lines,
    paymentInstallments,
    oneTimeTotal,
    recurringSubtotal,
    currency,
    company,
    contact,
    deal,
    member,
    contractTerms,
  };
};

export const useProposalDocumentData = (
  proposalId: string | number,
  options?: UseProposalDocumentDataOptions,
) => {
  const enabled = options?.enabled !== false && Boolean(proposalId);
  const fetchLinkedContract = options?.fetchLinkedContract !== false;
  const fetchContractTerms = options?.fetchContractTerms !== false;

  const {
    data: proposal,
    isPending: isProposalPending,
    isError: isProposalError,
    error: proposalError,
  } = useGetOne<Proposal>(
    "proposals",
    { id: proposalId },
    { enabled },
  );

  const { data: lines = [], isPending: isLinesPending } =
    useGetList<ProposalLineItem>(
      "proposal_line_items",
      {
        filter: { "proposal_id@eq": proposalId },
        pagination: { page: 1, perPage: 200 },
        sort: { field: "sort_order", order: "ASC" },
      },
      { enabled },
    );

  const { data: schedules = [] } = useGetList<ProposalPaymentSchedule>(
    "proposal_payment_schedules",
    {
      filter: { "proposal_id@eq": proposalId },
      pagination: { page: 1, perPage: 1 },
    },
    { enabled },
  );

  const { data: installments = [] } = useGetList<ProposalPaymentInstallment>(
    "proposal_payment_installments",
    {
      filter: { "proposal_id@eq": proposalId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "installment_number", order: "ASC" },
    },
    { enabled },
  );

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: proposal?.company_id! },
    { enabled: proposal?.company_id != null },
  );

  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: proposal?.contact_id! },
    { enabled: proposal?.contact_id != null },
  );

  const { data: deal } = useGetOne<Deal>(
    "deals",
    { id: proposal?.deal_id! },
    { enabled: proposal?.deal_id != null },
  );

  const { data: member } = useGetOne<OrganizationMember>(
    "organization_members",
    { id: proposal?.organization_member_id! },
    { enabled: proposal?.organization_member_id != null },
  );

  const { data: linkedContract } = useGetOne<Contract>(
    "contracts",
    { id: proposal?.contract_id! },
    {
      enabled:
        enabled &&
        fetchLinkedContract &&
        proposal?.contract_id != null,
    },
  );

  const { data: contractTermsList = [] } = useGetList<OrganizationContractTerms>(
    "organization_contract_terms",
    {
      filter: { "is_active@eq": true },
      pagination: { page: 1, perPage: 1 },
    },
    { enabled: enabled && fetchContractTerms },
  );

  const lineDrafts: ProposalLineDraft[] = useMemo(
    () =>
      lines.map((line, index) => ({
        key: `line-${line.id}`,
        description: line.description,
        quantity: line.quantity ?? 1,
        unit_price: line.unit_price ?? 0,
        billing_type: line.billing_type ?? "one_time",
        billing_interval: line.billing_interval ?? null,
        package_id: line.package_id ? Number(line.package_id) : null,
        addon_id: line.addon_id ? Number(line.addon_id) : null,
        sort_order: line.sort_order ?? index,
      })),
    [lines],
  );

  const schedule = schedules[0];
  const paymentInstallments = useMemo(() => {
    if (installments.length > 0) return installments;
    if (!proposal) return [];
    const config =
      (proposal.payment_schedule_config as {
        installment_frequency?: "weekly" | "biweekly" | "monthly";
        installment_count?: number;
      }) ?? {};
    return generatePaymentInstallments({
      depositAmount: proposal.deposit_amount ?? 0,
      balanceAmount: proposal.balance_amount ?? 0,
      config: {
        installment_frequency: schedule?.installment_frequency ?? config.installment_frequency ?? "weekly",
        installment_count: schedule?.installment_count ?? config.installment_count ?? 4,
        deposit_due_date: schedule?.deposit_due_date ?? null,
        balance_start_date: null,
      },
    }).map((row, index) => ({
      ...row,
      id: index,
      schedule_id: schedule?.id ?? 0,
      proposal_id: proposal.id,
      status: "pending" as const,
    }));
  }, [installments, proposal, schedule]);

  const basePackageLine = lineDrafts.find((line) =>
    isPackageLine(line),
  );

  const recurringSubtotal = lineDrafts
    .filter((line) => line.billing_type === "recurring")
    .reduce((sum, line) => sum + lineTotal(line.quantity, line.unit_price), 0);

  return {
    proposal,
    isLoading: enabled && (isProposalPending || isLinesPending),
    isError: enabled && isProposalError,
    error: proposalError,
    lineDrafts,
    lines,
    basePackageLine,
    paymentInstallments,
    company,
    contact,
    deal,
    member,
    contractTerms: contractTermsList[0] ?? null,
    linkedContract: linkedContract ?? null,
    oneTimeTotal: proposal?.one_time_total ?? 0,
    recurringSubtotal,
    recurringSummary: proposal?.recurring_summary ?? [],
    currency: proposal?.currency ?? "USD",
  };
};

export const formatProposalMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

export const lineItemTotal = (item: ProposalLineItem | ProposalLineDraft) =>
  lineTotal(item.quantity ?? 1, item.unit_price ?? 0);
