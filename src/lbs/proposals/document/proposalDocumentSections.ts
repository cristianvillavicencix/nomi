import {
  getProposalDocumentCopy,
  type ProposalLocale,
} from "@/lbs/proposals/document/proposalDocumentI18n";
import type {
  ProposalCustomSection,
  ProposalDocumentContent,
} from "@/lbs/proposals/document/proposalDocumentTypes";

/** Legacy deck section id — contract text belongs only in the accept dialog. */
const HIDDEN_CUSTOM_SECTION_IDS = new Set(["terms"]);

export const visibleProposalCustomSections = (
  sections: ProposalCustomSection[] | undefined,
): ProposalCustomSection[] =>
  (sections ?? []).filter((section) => !HIDDEN_CUSTOM_SECTION_IDS.has(section.id));

export type ProposalDocumentNavSection = {
  id: string;
  label: string;
  isCustom?: boolean;
  customSectionId?: string;
};

export const buildProposalDocumentSections = (
  content?: ProposalDocumentContent,
  locale: ProposalLocale = "en",
): ProposalDocumentNavSection[] => {
  const sections = getProposalDocumentCopy(locale).sections;
  const CORE_BEFORE_CUSTOM: ProposalDocumentNavSection[] = [
    { id: "intro", label: sections.intro },
    { id: "includes", label: sections.includes },
    { id: "investment", label: sections.investment },
    { id: "warranty", label: sections.warranty },
  ];
  const CORE_AFTER_CUSTOM: ProposalDocumentNavSection[] = [
    { id: "accept", label: sections.accept },
  ];
  const custom = (content?.custom_sections ?? []).map((section) => ({
    id: `custom-${section.id}`,
    label: section.title?.trim() || "Nueva sección",
    isCustom: true as const,
    customSectionId: section.id,
  }),
  );

  return [...CORE_BEFORE_CUSTOM, ...custom, ...CORE_AFTER_CUSTOM];
};

export const newCustomSectionId = () =>
  `section-${Date.now().toString(36)}`;
