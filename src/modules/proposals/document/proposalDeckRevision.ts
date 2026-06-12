import type { ProposalDocumentContent } from "@/modules/proposals/document/proposalDocumentTypes";

/**
 * Bump when canonical deck copy / section structure changes.
 * Proposals with a lower (or missing) `deck_revision` get fresh deck sections on hydrate.
 */
export const PROPOSAL_DECK_REVISION = 1;

export const getProposalDeckRevision = (
  content: Pick<ProposalDocumentContent, "deck_revision">,
): number => content.deck_revision ?? 0;

export const proposalNeedsDeckRevisionRefresh = (
  content: Pick<ProposalDocumentContent, "deck_revision">,
): boolean => getProposalDeckRevision(content) < PROPOSAL_DECK_REVISION;
