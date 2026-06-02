import type {
  ProposalCustomSection,
  ProposalDocumentContent,
} from "@/lbs/proposals/document/proposalDocumentTypes";
import type { ProposalLocale } from "@/lbs/proposals/document/proposalDocumentI18n";

const LOCALIZED_KEYS = [
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

export type ProposalLocalizedField = (typeof LOCALIZED_KEYS)[number];

export const resolveProposalDocumentContent = (
  content: ProposalDocumentContent,
  locale: ProposalLocale,
): ProposalDocumentContent => {
  if (locale === "en") {
    return content;
  }

  const fromLocaleBlock = content.locales?.es;
  const resolved: ProposalDocumentContent = { ...content };

  for (const key of LOCALIZED_KEYS) {
    const esSuffix = content[`${key}_es` as keyof ProposalDocumentContent];
    const fromBlock = fromLocaleBlock?.[key];
    const value =
      (typeof fromBlock === "string" && fromBlock.trim() ? fromBlock : null) ??
      (typeof esSuffix === "string" && esSuffix.trim() ? esSuffix : null);
    if (value) {
      (resolved as Record<string, unknown>)[key] = value;
    }
  }

  if (content.custom_sections_es?.length) {
    resolved.custom_sections = mergeCustomSections(
      content.custom_sections,
      content.custom_sections_es,
    );
  }

  return resolved;
};

const mergeCustomSections = (
  base: ProposalCustomSection[] | undefined,
  es: ProposalCustomSection[],
): ProposalCustomSection[] => {
  const byId = new Map(es.map((section) => [section.id, section]));
  const merged = (base ?? []).map((section) => {
    const translated = byId.get(section.id);
    if (!translated) return section;
    return {
      ...section,
      title: translated.title?.trim() ? translated.title : section.title,
      body: translated.body?.trim() ? translated.body : section.body,
    };
  });
  return merged.length > 0 ? merged : es;
};
