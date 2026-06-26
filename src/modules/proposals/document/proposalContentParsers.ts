import { parseProposalTimelineBars } from "@/modules/proposals/document/proposalTimeline";
import {
  emptyProposalDocumentContent,
  type ProposalAboutStats,
  type ProposalClientLogo,
  type ProposalCustomSection,
  type ProposalDocumentContent,
  type ProposalLocaleContentBlock,
  type ProposalPortfolioItem,
  type ProposalTeamMember,
} from "@/modules/proposals/document/proposalDocumentTypes";

function parsePortfolioItems(
  raw: unknown,
): ProposalPortfolioItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const title = typeof item.title === "string" ? item.title : "";
      if (!title.trim()) return null;
      return {
        id: typeof item.id === "string" ? item.id : `portfolio-${index}`,
        title,
        subtitle: typeof item.subtitle === "string" ? item.subtitle : "",
        image_url:
          typeof item.image_url === "string"
            ? item.image_url
            : item.image_url === null
              ? null
              : undefined,
      };
    })
    .filter((item): item is ProposalPortfolioItem => item != null);
}

function parseTeamMembers(raw: unknown): ProposalTeamMember[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const name = typeof item.name === "string" ? item.name : "";
      if (!name.trim()) return null;
      return {
        id: typeof item.id === "string" ? item.id : `team-${index}`,
        name,
        role: typeof item.role === "string" ? item.role : "",
        bio: typeof item.bio === "string" ? item.bio : "",
        image_url:
          typeof item.image_url === "string"
            ? item.image_url
            : item.image_url === null
              ? null
              : undefined,
      };
    })
    .filter((item): item is ProposalTeamMember => item != null);
}

function parseClientLogos(raw: unknown): ProposalClientLogo[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const imageUrl =
        typeof item.image_url === "string"
          ? item.image_url
          : item.image_url === null
            ? null
            : "";
      const name = typeof item.name === "string" ? item.name : "";
      if (!imageUrl?.trim() && !name.trim()) return null;
      return {
        id: typeof item.id === "string" ? item.id : `client-logo-${index}`,
        name: name || undefined,
        image_url: imageUrl,
      };
    })
    .filter((item): item is ProposalClientLogo => item != null);
}

function parseAboutStats(raw: unknown): ProposalAboutStats | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  return {
    websites: typeof record.websites === "string" ? record.websites : undefined,
    years: typeof record.years === "string" ? record.years : undefined,
    leads: typeof record.leads === "string" ? record.leads : undefined,
    retention:
      typeof record.retention === "string" ? record.retention : undefined,
  };
}

function parseCustomSections(
  raw: unknown,
): ProposalCustomSection[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const sections = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : null;
      if (!id) return null;
      return {
        id,
        title: typeof row.title === "string" ? row.title : "",
        body: typeof row.body === "string" ? row.body : "",
        image_url:
          typeof row.image_url === "string"
            ? row.image_url
            : row.image_url === null
              ? null
              : undefined,
      };
    })
    .filter((row): row is ProposalCustomSection => row != null);
  return sections.length > 0 ? sections : undefined;
}

function parseEsSuffixFields(
  record: Record<string, unknown>,
): Partial<ProposalDocumentContent> {
  const keys = [
    "hero_title",
    "hero_subtitle",
    "hero_image_url",
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
  const out: Partial<ProposalDocumentContent> = {};
  for (const key of keys) {
    const esKey = `${key}_es`;
    const value = record[esKey];
    if (typeof value === "string" || value === null) {
      (out as Record<string, string | null>)[esKey] = value as string | null;
    }
  }
  return out;
}

function parseLocaleContentBlock(
  raw: unknown,
): ProposalLocaleContentBlock | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const block: ProposalLocaleContentBlock = {};
  const keys = [
    "hero_title",
    "hero_subtitle",
    "hero_image_url",
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
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || value === null) {
      (block as Record<string, string | null>)[key] = value as string | null;
    }
  }
  return Object.keys(block).length > 0 ? block : undefined;
}

function parseLocalesBlock(raw: unknown): ProposalDocumentContent["locales"] {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const es = parseLocaleContentBlock(record.es);
  return es ? { es } : undefined;
}

/** Stable JSON for comparing draft vs saved proposal `content`. */
export const proposalContentSnapshot = (raw: unknown): string =>
  JSON.stringify(parseProposalContent(raw));

export const parseProposalContent = (raw: unknown): ProposalDocumentContent => {
  if (!raw || typeof raw !== "object") {
    return emptyProposalDocumentContent();
  }
  const record = raw as Record<string, unknown>;
  return {
    ...emptyProposalDocumentContent(),
    template_id:
      typeof record.template_id === "number" ? record.template_id : null,
    template_slug:
      typeof record.template_slug === "string" ? record.template_slug : null,
    hero_title:
      typeof record.hero_title === "string" ? record.hero_title : undefined,
    hero_subtitle:
      typeof record.hero_subtitle === "string"
        ? record.hero_subtitle
        : undefined,
    hero_image_url:
      typeof record.hero_image_url === "string"
        ? record.hero_image_url
        : record.hero_image_url === null
          ? null
          : undefined,
    intro_title:
      typeof record.intro_title === "string" ? record.intro_title : undefined,
    intro_body:
      typeof record.intro_body === "string" ? record.intro_body : undefined,
    warranty_title:
      typeof record.warranty_title === "string"
        ? record.warranty_title
        : undefined,
    warranty_body:
      typeof record.warranty_body === "string"
        ? record.warranty_body
        : undefined,
    investment_title:
      typeof record.investment_title === "string"
        ? record.investment_title
        : undefined,
    investment_notes:
      typeof record.investment_notes === "string"
        ? record.investment_notes
        : undefined,
    payment_notes:
      typeof record.payment_notes === "string"
        ? record.payment_notes
        : undefined,
    terms_title:
      typeof record.terms_title === "string" ? record.terms_title : undefined,
    terms_body:
      typeof record.terms_body === "string" ? record.terms_body : undefined,
    accept_title:
      typeof record.accept_title === "string" ? record.accept_title : undefined,
    accept_body:
      typeof record.accept_body === "string" ? record.accept_body : undefined,
    custom_sections: parseCustomSections(record.custom_sections),
    custom_sections_es: parseCustomSections(record.custom_sections_es),
    portfolio_items: parsePortfolioItems(record.portfolio_items),
    team_members: parseTeamMembers(record.team_members),
    client_logos: parseClientLogos(record.client_logos),
    intro_signatory_image_url:
      typeof record.intro_signatory_image_url === "string"
        ? record.intro_signatory_image_url
        : record.intro_signatory_image_url === null
          ? null
          : undefined,
    intro_signatory_name:
      typeof record.intro_signatory_name === "string"
        ? record.intro_signatory_name
        : undefined,
    intro_signatory_company:
      typeof record.intro_signatory_company === "string"
        ? record.intro_signatory_company
        : undefined,
    intro_signatory_bio:
      typeof record.intro_signatory_bio === "string"
        ? record.intro_signatory_bio
        : undefined,
    about_stats: parseAboutStats(record.about_stats),
    timeline_bars: parseProposalTimelineBars(record.timeline_bars),
    locales: parseLocalesBlock(record.locales),
    ...parseEsSuffixFields(record),
  };
};
