import type { ProposalDocumentCopy } from "@/lbs/proposals/document/proposalDocumentI18n";

export type ProposalNavStepKey = keyof ProposalDocumentCopy["nav"];

const DECK_SECTION_NAV_KEYS: Record<string, ProposalNavStepKey> = {
  "about-us": "aboutUs",
  "work-reviews": "workReviews",
  "what-we-deliver": "whatWeDeliver",
  "website-features": "websiteFeatures",
  guidelines: "whatWeDeliver",
  process: "process",
  "content-management": "contentManagement",
  timeline: "timeline",
  "project-timeline": "timeline",
};

/** Short, friendly sidebar label for known deck sections (not the long section headline). */
export const proposalDeckNavLabel = (
  sectionId: string,
  copy: ProposalDocumentCopy,
  fallbackTitle?: string,
): string => {
  const key = DECK_SECTION_NAV_KEYS[sectionId];
  if (key) return copy.nav[key];
  return fallbackTitle?.trim() || copy.nav.custom;
};
