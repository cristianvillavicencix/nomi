import { CONTRACTOR_BRIEF_SECTIONS } from "@/modules/deals/contractorBriefSchema";

export type BriefRequestSection = string;

export type BriefRequestScope = {
  sections: BriefRequestSection[];
};

/** Full contractor brief (all sections). */
export const FULL_BRIEF_REQUEST: BriefRequestScope = {
  sections: CONTRACTOR_BRIEF_SECTIONS.map((section) => section.id),
};

/**
 * Default client send — quick website brief.
 * Maps to: confirm → business → goals/scope → design → content.
 */
export const ESSENTIAL_BRIEF_REQUEST: BriefRequestScope = {
  sections: [
    "confirm_data",
    "about_business",
    "services",
    "brand_style",
    "web_content",
  ],
};

export const ESSENTIAL_BRIEF_SECTION_IDS = ESSENTIAL_BRIEF_REQUEST.sections;

export const parseBriefSectionsParam = (
  value: string | null,
): BriefRequestSection[] | null => {
  if (!value?.trim()) return null;
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

export const buildBriefSectionsParam = (sections: BriefRequestSection[]) =>
  sections.join(",");

export const appendBriefScopeToUrl = (
  url: string,
  scope: BriefRequestScope,
) => {
  const next = new URL(url, window.location.origin);
  next.searchParams.set("sections", buildBriefSectionsParam(scope.sections));
  return next.toString();
};

export const scopeForBriefSection = (sectionId: string): BriefRequestScope => ({
  sections: [sectionId],
});

export const readBriefScopeFromLocation = (): BriefRequestSection[] | null => {
  const params = new URLSearchParams(window.location.search);
  return parseBriefSectionsParam(params.get("sections"));
};

/** Prefer scope order so Essential packs follow confirm → … → content. */
export const filterBriefSections = <T extends { id: string }>(
  sections: T[],
  scope: BriefRequestSection[] | null,
): T[] => {
  if (!scope?.length) return sections;
  const byId = new Map(sections.map((section) => [section.id, section]));
  return scope
    .map((id) => byId.get(id))
    .filter((section): section is T => section != null);
};

const sameSectionSet = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
};

export const isEssentialBriefScope = (
  sections: BriefRequestSection[] | null | undefined,
): boolean =>
  Boolean(sections?.length) &&
  sameSectionSet(sections!, ESSENTIAL_BRIEF_REQUEST.sections);

export const isFullBriefScope = (
  sections: BriefRequestSection[] | null | undefined,
): boolean =>
  Boolean(sections?.length) &&
  sameSectionSet(sections!, FULL_BRIEF_REQUEST.sections);

const BRIEF_SECTION_LABELS: Record<string, string> = Object.fromEntries(
  CONTRACTOR_BRIEF_SECTIONS.map((section) => [
    section.id,
    section.title ?? section.id,
  ]),
);

export const getBriefScopeSummary = (scope: BriefRequestScope): string => {
  if (scope.sections.length === 0) return "Project brief";
  if (isEssentialBriefScope(scope.sections)) return "Quick website brief";
  if (isFullBriefScope(scope.sections)) return "Full project brief";
  return scope.sections
    .map((id) => BRIEF_SECTION_LABELS[id] ?? id.replace(/_/g, " "))
    .join(", ");
};
