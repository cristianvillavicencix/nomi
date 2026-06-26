import {
  getProposalDocumentCopy,
  type ProposalLocale,
} from "@/modules/proposals/document/proposalDocumentI18n";
import { proposalDeckNavLabel } from "@/modules/proposals/document/proposalDeckNav";
import { partitionProposalDeckSections } from "@/modules/proposals/document/proposalDeckSectionOrder";
import type {
  ProposalCustomSection,
  ProposalDocumentContent,
} from "@/modules/proposals/document/proposalDocumentTypes";

/** Legacy deck section id — contract text belongs only in the accept dialog. */
const HIDDEN_CUSTOM_SECTION_IDS = new Set(["terms"]);

export const visibleProposalCustomSections = (
  sections: ProposalCustomSection[] | undefined,
): ProposalCustomSection[] =>
  (sections ?? []).filter(
    (section) => !HIDDEN_CUSTOM_SECTION_IDS.has(section.id),
  );

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
  const copy = getProposalDocumentCopy(locale);
  const { narrative, timeline } = partitionProposalDeckSections(
    visibleProposalCustomSections(content?.custom_sections),
  );

  const narrativeNav = narrative.map((section) => ({
    id: `custom-${section.id}`,
    label: proposalDeckNavLabel(section.id, copy, section.title),
    isCustom: true as const,
    customSectionId: section.id,
  }));

  const timelineNav: ProposalDocumentNavSection[] = timeline
    ? [
        {
          id: `custom-${timeline.id}`,
          label: proposalDeckNavLabel(timeline.id, copy, timeline.title),
          isCustom: true as const,
          customSectionId: timeline.id,
        },
      ]
    : [];

  return [
    { id: "intro", label: copy.nav.intro },
    ...narrativeNav,
    ...timelineNav,
    { id: "investment", label: copy.nav.investment },
    { id: "accept", label: copy.nav.accept },
  ];
};

export const newCustomSectionId = () => `section-${Date.now().toString(36)}`;
