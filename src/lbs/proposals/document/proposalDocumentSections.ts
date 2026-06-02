import {
  getProposalDocumentCopy,
  type ProposalLocale,
} from "@/lbs/proposals/document/proposalDocumentI18n";
import type { ProposalDocumentContent } from "@/lbs/proposals/document/proposalDocumentTypes";

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
    { id: "terms", label: sections.terms },
    { id: "accept", label: sections.accept },
  ];
  const custom = (content?.custom_sections ?? []).map((section) => ({
    id: `custom-${section.id}`,
    label: section.title?.trim() || "Nueva sección",
    isCustom: true as const,
    customSectionId: section.id,
  }));

  return [...CORE_BEFORE_CUSTOM, ...custom, ...CORE_AFTER_CUSTOM];
};

export const newCustomSectionId = () =>
  `section-${Date.now().toString(36)}`;
