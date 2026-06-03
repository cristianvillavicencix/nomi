import { buildProposalDeckSections } from "@/lbs/proposals/document/proposalDeckSectionBodies";
import type { ProposalDeckPresetId } from "@/lbs/proposals/document/proposalDeckSectionOrder";
import { PROPOSAL_DECK_REVISION } from "@/lbs/proposals/document/proposalDeckRevision";
import type { ProposalTemplateContent } from "@/lbs/proposals/document/proposalDocumentTypes";

export type { ProposalDeckPresetId };

/** Proposal deck sections (EN + ES) per template family. */
export const PROPOSAL_DECK_SECTIONS: Record<
  ProposalDeckPresetId,
  ReturnType<typeof buildProposalDeckSections>
> = {
  "website-contractor": buildProposalDeckSections("website-contractor"),
  "website-redesign": buildProposalDeckSections("website-redesign"),
  "digital-marketing": buildProposalDeckSections("digital-marketing"),
  skop: buildProposalDeckSections("skop"),
  blank: buildProposalDeckSections("blank"),
};

export const attachDeckSections = (
  slug: string,
  content: ProposalTemplateContent,
): ProposalTemplateContent => {
  const preset = PROPOSAL_DECK_SECTIONS[slug as ProposalDeckPresetId];
  if (!preset) return content;
  return {
    ...content,
    custom_sections: preset.en,
    custom_sections_es: preset.es,
    deck_revision: PROPOSAL_DECK_REVISION,
  };
};
