import { CONTRACTOR_BRIEF_SECTIONS } from "@/lbs/deals/contractorBriefSchema";

export type BriefRequestSection = string;

export type BriefRequestScope = {
  sections: BriefRequestSection[];
};

export const FULL_BRIEF_REQUEST: BriefRequestScope = {
  sections: CONTRACTOR_BRIEF_SECTIONS.map((section) => section.id),
};

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

export const appendBriefScopeToUrl = (url: string, scope: BriefRequestScope) => {
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

export const filterBriefSections = <T extends { id: string }>(
  sections: T[],
  scope: BriefRequestSection[] | null,
): T[] => {
  if (!scope?.length) return sections;
  const allowed = new Set(scope);
  return sections.filter((section) => allowed.has(section.id));
};

const BRIEF_SECTION_LABELS: Record<string, string> = Object.fromEntries(
  CONTRACTOR_BRIEF_SECTIONS.map((section) => [
    section.id,
    section.title ?? section.id,
  ]),
);

export const getBriefScopeSummary = (scope: BriefRequestScope): string => {
  if (scope.sections.length === 0) return "Project brief";
  if (scope.sections.length === FULL_BRIEF_REQUEST.sections.length) {
    return "Full project brief";
  }
  return scope.sections
    .map((id) => BRIEF_SECTION_LABELS[id] ?? id.replace(/_/g, " "))
    .join(", ");
};
