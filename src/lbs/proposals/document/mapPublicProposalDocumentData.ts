import type { Company, Contact, Deal, OrganizationMember } from "@/components/atomic-crm/types";
import type { PublicProposalPayload } from "@/lbs/proposals/public/publicProposalApi";
import type { ProposalLineDraft } from "@/lbs/proposals/proposalCommercialUtils";
import type {
  OrganizationContractTerms,
  Proposal,
  ProposalLineItem,
  ProposalPaymentInstallment,
} from "@/lbs/types";

export type ProposalDocumentDataSnapshot = {
  proposal: Proposal;
  lineDrafts: ProposalLineDraft[];
  lines?: ProposalLineItem[];
  paymentInstallments: ProposalPaymentInstallment[];
  oneTimeTotal: number;
  recurringSubtotal: number;
  currency: string;
  company?: Company | null;
  contact?: Contact | null;
  deal?: Deal | null;
  member?: OrganizationMember | null;
  contractTerms?: OrganizationContractTerms | null;
};

export const mapPublicProposalDocumentData = (
  payload: PublicProposalPayload,
): ProposalDocumentDataSnapshot => {
  const { proposal: raw, line_items, installments } = payload;
  const currency = raw.currency ?? "USD";

  const lineDrafts: ProposalLineDraft[] = line_items.map((line, index) => ({
    key: `public-line-${index}`,
    description: line.description,
    quantity: line.quantity ?? 1,
    unit_price: line.unit_price ?? 0,
    billing_type: (line.billing_type as "one_time" | "recurring") ?? "one_time",
    billing_interval: line.billing_interval ?? null,
    sort_order: index,
  }));

  const oneTimeLines = lineDrafts.filter((line) => line.billing_type === "one_time");
  const recurringLines = lineDrafts.filter((line) => line.billing_type === "recurring");
  const oneTimeTotal =
    oneTimeLines.reduce(
      (sum, line) => sum + (line.quantity ?? 1) * (line.unit_price ?? 0),
      0,
    ) || raw.amount || 0;
  const recurringSubtotal = recurringLines.reduce(
    (sum, line) => sum + (line.quantity ?? 1) * (line.unit_price ?? 0),
    0,
  );

  const proposal = {
    id: raw.id,
    title: raw.title,
    status: raw.status,
    amount: raw.amount,
    proposal_number: raw.proposal_number ?? null,
    currency,
    validity_days: raw.validity_days,
    valid_until: raw.valid_until ?? null,
    deposit_amount: raw.deposit_amount ?? 0,
    balance_amount: raw.balance_amount ?? 0,
    deposit_percent: raw.deposit_percent ?? 50,
    notes: raw.notes ?? null,
    sent_at: raw.sent_at ?? null,
    viewed_at: raw.viewed_at ?? null,
    accepted_at: raw.accepted_at ?? null,
    contract_id: raw.contract_id ?? null,
    one_time_total: oneTimeTotal,
    content: raw.content,
  } as Proposal;

  const paymentInstallments: ProposalPaymentInstallment[] = installments.map(
    (row) => ({
      id: row.installment_number,
      proposal_id: raw.id,
      schedule_id: 0,
      installment_number: row.installment_number,
      label: row.label,
      due_date: row.due_date,
      amount: row.amount,
      billing_type: (row.billing_type as "one_time" | "recurring") ?? "one_time",
      status: (row.status as ProposalPaymentInstallment["status"]) ?? "pending",
    }),
  );

  return {
    proposal,
    lineDrafts,
    paymentInstallments,
    oneTimeTotal,
    recurringSubtotal,
    currency,
  };
};
