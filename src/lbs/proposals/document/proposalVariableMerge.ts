import type { Company, Contact, Deal, OrganizationMember } from "@/components/atomic-crm/types";
import type { Proposal } from "@/lbs/types";

export type ProposalVariableContext = {
  cliente?: string;
  empresa?: string;
  deal?: string;
  preparada_por?: string;
  proposal_number?: string;
  valid_until?: string;
  fecha?: string;
};

export const buildProposalVariableContext = ({
  proposal,
  company,
  contact,
  deal,
  member,
}: {
  proposal: Proposal;
  company?: Company | null;
  contact?: Contact | null;
  deal?: Deal | null;
  member?: OrganizationMember | null;
}): ProposalVariableContext => {
  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : "";

  return {
    cliente: contactName || company?.name || "your team",
    empresa: company?.name ?? "your company",
    deal: deal?.name ?? "",
    preparada_por: member
      ? `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() ||
        member.email
      : "Latinos Business Support",
    proposal_number: proposal.proposal_number ?? "",
    valid_until: proposal.valid_until ?? "",
    fecha: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
};

const mergeOne = (text: string, variables: ProposalVariableContext) =>
  text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key as keyof ProposalVariableContext];
    return value != null && value !== "" ? String(value) : `{{${key}}}`;
  });

export const mergeProposalVariables = (
  content: Record<string, unknown>,
  variables: ProposalVariableContext,
): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    merged[key] =
      typeof value === "string" && value.length > 0
        ? mergeOne(value, variables)
        : value;
  }
  return merged;
};
