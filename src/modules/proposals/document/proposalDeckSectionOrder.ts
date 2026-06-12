import type { ProposalCustomSection } from "@/modules/proposals/document/proposalDocumentTypes";

export type ProposalDeckPresetId =
  | "website-contractor"
  | "website-redesign"
  | "digital-marketing"
  | "skop"
  | "blank";

const LEGACY_DECK_SECTION_IDS = new Set([
  "overview",
  "goals",
  "scope",
  "requirements",
  "support",
  "faq",
  "next",
]);

export const proposalUsesLegacyDeck = (
  sections: ProposalCustomSection[] | undefined,
): boolean =>
  (sections ?? []).some((section) => LEGACY_DECK_SECTION_IDS.has(section.id));

/** Proposals saved before work-reviews / formal deck — refresh on preview load. */
export const proposalNeedsFormalDeckRefresh = (
  sections: ProposalCustomSection[] | undefined,
): boolean => {
  const ids = new Set((sections ?? []).map((section) => section.id));
  if (ids.has("guidelines") && !ids.has("work-reviews")) return true;
  if (ids.has("about-us") && !ids.has("work-reviews")) return true;
  return false;
};

/** Narrative deck sections — rendered after intro, before timeline & investment. */
export const PROPOSAL_DECK_NARRATIVE_IDS = [
  "about-us",
  "work-reviews",
  "what-we-deliver",
  "website-features",
  "process",
  "content-management",
] as const;

/** Legacy section kept for older proposals; not in default deck. */
export const PROPOSAL_GUIDELINES_SECTION_ID = "guidelines";

export type ProposalDeckNarrativeId = (typeof PROPOSAL_DECK_NARRATIVE_IDS)[number];

export const PROPOSAL_TIMELINE_SECTION_IDS = new Set(["timeline", "project-timeline"]);

const NARRATIVE_SORT_INDEX: Record<string, number> = Object.fromEntries(
  PROPOSAL_DECK_NARRATIVE_IDS.map((id, index) => [id, index]),
);

/** Legacy deck ids → slot in the new order (for existing proposals). */
const LEGACY_NARRATIVE_SORT_INDEX: Record<string, number> = {
  overview: 0,
  goals: 0,
  scope: 2,
  guidelines: 2,
  requirements: 5,
  support: 5,
  faq: 1,
  next: 4,
};

const narrativeSortKey = (section: ProposalCustomSection) => {
  const direct = NARRATIVE_SORT_INDEX[section.id];
  if (direct != null) return direct;
  const legacy = LEGACY_NARRATIVE_SORT_INDEX[section.id];
  if (legacy != null) return legacy;
  return 100 + section.id.localeCompare("");
};

export const sortProposalNarrativeSections = (
  sections: ProposalCustomSection[],
): ProposalCustomSection[] =>
  [...sections].sort(
    (a, b) => narrativeSortKey(a) - narrativeSortKey(b) || a.id.localeCompare(b.id),
  );

export const partitionProposalDeckSections = (
  sections: ProposalCustomSection[],
): {
  narrative: ProposalCustomSection[];
  timeline: ProposalCustomSection | null;
} => {
  const timeline =
    sections.find((section) => PROPOSAL_TIMELINE_SECTION_IDS.has(section.id)) ??
    null;
  const narrative = sortProposalNarrativeSections(
    sections.filter((section) => !PROPOSAL_TIMELINE_SECTION_IDS.has(section.id)),
  );
  return { narrative, timeline };
};
