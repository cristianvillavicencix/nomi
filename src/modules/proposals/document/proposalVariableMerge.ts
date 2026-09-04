import type {
  Company,
  Contact,
  Deal,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import type {
  ProposalCustomSection,
  ProposalDocumentContent,
  ProposalLocaleContentBlock,
} from "@/modules/proposals/document/proposalDocumentTypes";
import type { Proposal } from "@/modules/types";

export type ProposalVariableKey = keyof ProposalVariableContext;

export type ProposalVariableContext = {
  cliente?: string;
  empresa?: string;
  deal?: string;
  preparada_por?: string;
  proposal_number?: string;
  valid_until?: string;
  fecha?: string;
};

/** Document proposal placeholders — use as `{{empresa}}` in titles, intro, deck sections, etc. */
export const PROPOSAL_DOCUMENT_VARIABLE_DEFINITIONS: {
  key: ProposalVariableKey;
  label: string;
  description: string;
}[] = [
  {
    key: "empresa",
    label: "Company",
    description:
      "Linked company on the proposal (Settings on the proposal record).",
  },
  {
    key: "cliente",
    label: "Client name",
    description: "Primary contact name, or company name if no contact is set.",
  },
  {
    key: "preparada_por",
    label: "Prepared by",
    description:
      "Proposal owner / organization member assigned to the proposal.",
  },
  {
    key: "deal",
    label: "Project",
    description: "Linked project name, if the proposal is tied to a project.",
  },
  {
    key: "proposal_number",
    label: "Proposal #",
    description: "Proposal number from the record.",
  },
  {
    key: "valid_until",
    label: "Valid until",
    description: "Proposal expiry date (formatted).",
  },
  {
    key: "fecha",
    label: "Today's date",
    description: "Date shown when the document is viewed (not stored in text).",
  },
];

const LOCALIZED_STRING_KEYS = [
  "hero_title",
  "hero_subtitle",
  "intro_title",
  "intro_body",
  "investment_title",
  "investment_notes",
  "payment_notes",
  "warranty_title",
  "warranty_body",
  "terms_title",
  "terms_body",
  "accept_title",
  "accept_body",
] as const;

export const buildProposalVariableContext = ({
  proposal,
  company,
  contact,
  deal,
  member,
  organizationName,
}: {
  proposal: Proposal;
  company?: Company | null;
  contact?: Contact | null;
  deal?: Deal | null;
  member?: OrganizationMember | null;
  organizationName?: string | null;
}): ProposalVariableContext => {
  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : "";

  const formattedValidUntil = proposal.valid_until
    ? new Date(`${proposal.valid_until}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return {
    cliente: contactName || company?.name || "your team",
    empresa:
      company?.name?.trim() || organizationName?.trim() || "your company",
    deal: deal?.name ?? "",
    preparada_por: member
      ? `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() ||
        member.email
      : "Latinos Business Support",
    proposal_number: proposal.proposal_number ?? "",
    valid_until: formattedValidUntil,
    fecha: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
};

export const mergeTextVariables = (
  text: string,
  variables: ProposalVariableContext,
): string =>
  text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key as keyof ProposalVariableContext];
    return value != null && value !== "" ? String(value) : `{{${key}}}`;
  });

const mergeOptionalText = (
  value: string | null | undefined,
  variables: ProposalVariableContext,
) => {
  if (typeof value !== "string" || !value.length) return value;
  return mergeTextVariables(value, variables);
};

const mergeLocaleBlock = (
  block: ProposalLocaleContentBlock | undefined,
  variables: ProposalVariableContext,
): ProposalLocaleContentBlock | undefined => {
  if (!block) return block;
  const next: ProposalLocaleContentBlock = { ...block };
  for (const key of LOCALIZED_STRING_KEYS) {
    const raw = block[key];
    if (typeof raw === "string" && raw.length > 0) {
      next[key] = mergeTextVariables(raw, variables);
    }
  }
  return next;
};

const mergeCustomSections = (
  sections: ProposalCustomSection[] | undefined,
  variables: ProposalVariableContext,
): ProposalCustomSection[] | undefined =>
  sections?.map((section) => ({
    ...section,
    title: mergeOptionalText(section.title, variables) ?? section.title,
    body: mergeOptionalText(section.body, variables) ?? section.body,
  }));

/** Replace `{{empresa}}`, `{{preparada_por}}`, etc. in all proposal text fields. */
export const mergeProposalDocumentContent = (
  content: ProposalDocumentContent,
  variables: ProposalVariableContext,
): ProposalDocumentContent => {
  const next: ProposalDocumentContent = {
    ...content,
    custom_sections: mergeCustomSections(content.custom_sections, variables),
    custom_sections_es: mergeCustomSections(
      content.custom_sections_es,
      variables,
    ),
    locales: content.locales
      ? {
          es: mergeLocaleBlock(content.locales.es, variables),
        }
      : content.locales,
  };

  for (const key of LOCALIZED_STRING_KEYS) {
    const raw = content[key];
    if (typeof raw === "string" && raw.length > 0) {
      next[key] = mergeTextVariables(raw, variables);
    }
    const esKey = `${key}_es` as keyof ProposalDocumentContent;
    const esRaw = content[esKey];
    if (typeof esRaw === "string" && esRaw.length > 0) {
      (next as Record<string, unknown>)[esKey] = mergeTextVariables(
        esRaw,
        variables,
      );
    }
  }

  return next;
};

/** @deprecated Prefer mergeProposalDocumentContent for full document merge. */
export const mergeProposalVariables = (
  content: Record<string, unknown>,
  variables: ProposalVariableContext,
): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    merged[key] =
      typeof value === "string" && value.length > 0
        ? mergeTextVariables(value, variables)
        : value;
  }
  return merged;
};
