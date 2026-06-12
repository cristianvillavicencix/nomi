import type { Company, Contact, Deal, OrganizationMember } from "@/components/atomic-crm/types";
import type { PublicProposalPayload } from "@/modules/proposals/public/publicProposalApi";

const mapPublicContact = (
  row: PublicProposalPayload["contact"],
): Contact | null => {
  if (!row) return null;
  return {
    id: row.id,
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
  } as Contact;
};

const mapPublicCompany = (
  row: PublicProposalPayload["company"],
): Company | null => {
  if (!row?.name?.trim()) return null;
  return {
    id: row.id ?? 0,
    name: row.name,
  } as Company;
};

const mapPublicMember = (
  row: PublicProposalPayload["member"],
): OrganizationMember | null => {
  if (!row) return null;
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return {
    id: row.id,
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    email: row.email ?? "",
  } as OrganizationMember;
};
import type { ProposalLineDraft } from "@/modules/proposals/proposalCommercialUtils";
import type {
  OrganizationContractTerms,
  Proposal,
  ProposalLineItem,
  ProposalPaymentInstallment,
} from "@/modules/types";

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
  organization?: { name: string } | null;
  contractTerms?: OrganizationContractTerms | null;
  /** Merged org + proposal terms for client display (from public API). */
  termsMarkdown?: string | null;
  termsTitle?: string | null;
};

export const mapPublicProposalDocumentData = (
  payload: PublicProposalPayload,
): ProposalDocumentDataSnapshot => {
  const termsMarkdown = payload.terms_markdown?.trim() || null;
  const termsTitle = payload.terms_title?.trim() || null;
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
    company: mapPublicCompany(payload.company),
    contact: mapPublicContact(payload.contact),
    member: mapPublicMember(payload.member),
    organization: payload.organization ?? null,
    termsMarkdown,
    termsTitle,
    contractTerms: termsMarkdown
      ? ({
          body_markdown: termsMarkdown,
          title: termsTitle ?? "Contract terms",
        } as OrganizationContractTerms)
      : null,
  };
};
