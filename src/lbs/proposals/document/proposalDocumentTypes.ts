export const PROPOSAL_DOCUMENT_SECTIONS = [
  { id: "intro", label: "Introduction" },
  { id: "includes", label: "What's included" },
  { id: "investment", label: "Investment" },
  { id: "warranty", label: "Warranty" },
  { id: "terms", label: "Terms" },
  { id: "accept", label: "Accept" },
] as const;

/** Spanish labels for LBS proposal document sidebar (prototype). */
export const PROPOSAL_DOCUMENT_SECTIONS_ES = [
  { id: "intro", label: "Introducción" },
  { id: "includes", label: "Qué incluye" },
  { id: "investment", label: "Inversión" },
  { id: "warranty", label: "Garantía" },
  { id: "terms", label: "Términos" },
  { id: "accept", label: "Aceptar" },
] as const;

export type ProposalDocumentSectionId =
  (typeof PROPOSAL_DOCUMENT_SECTIONS)[number]["id"];

export type ProposalCustomSection = {
  id: string;
  title: string;
  body: string;
};

export type ProposalLocaleContentBlock = {
  hero_title?: string;
  hero_subtitle?: string;
  intro_title?: string;
  intro_body?: string;
  investment_title?: string;
  investment_notes?: string;
  payment_notes?: string;
  warranty_title?: string;
  warranty_body?: string;
  terms_title?: string;
  terms_body?: string;
  accept_title?: string;
  accept_body?: string;
};

export type ProposalDocumentContent = ProposalLocaleContentBlock & {
  template_id?: number | null;
  template_slug?: string | null;
  /** Spanish overrides (legacy flat fields). */
  hero_title_es?: string;
  hero_subtitle_es?: string;
  intro_title_es?: string;
  intro_body_es?: string;
  investment_title_es?: string;
  investment_notes_es?: string;
  payment_notes_es?: string;
  warranty_title_es?: string;
  warranty_body_es?: string;
  terms_title_es?: string;
  terms_body_es?: string;
  accept_title_es?: string;
  accept_body_es?: string;
  locales?: {
    es?: ProposalLocaleContentBlock;
  };
  custom_sections?: ProposalCustomSection[];
  custom_sections_es?: ProposalCustomSection[];
};

export type ProposalTemplateContent = ProposalDocumentContent;

export type ProposalTemplate = {
  org_id?: number;
  name: string;
  slug: string;
  category?: string | null;
  content: ProposalTemplateContent;
  is_system?: boolean;
  active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
} & { id: number };

export const emptyProposalDocumentContent = (): ProposalDocumentContent => ({
  hero_title: "Your professional web presence",
  hero_subtitle: "",
  intro_title: "Let's grow your business online",
  intro_body: "",
  warranty_title: "Work with confidence",
  warranty_body: "",
});

export const parseProposalContent = (
  raw: unknown,
): ProposalDocumentContent => {
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
    locales: parseLocalesBlock(record.locales),
    ...parseEsSuffixFields(record),
  };
};

const parseEsSuffixFields = (
  record: Record<string, unknown>,
): Partial<ProposalDocumentContent> => {
  const keys = [
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
  const out: Partial<ProposalDocumentContent> = {};
  for (const key of keys) {
    const esKey = `${key}_es`;
    const value = record[esKey];
    if (typeof value === "string") {
      (out as Record<string, string>)[esKey] = value;
    }
  }
  return out;
};

const parseLocaleContentBlock = (
  raw: unknown,
): ProposalLocaleContentBlock | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const block: ProposalLocaleContentBlock = {};
  const keys = [
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
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") block[key] = value;
  }
  return Object.keys(block).length > 0 ? block : undefined;
};

const parseLocalesBlock = (
  raw: unknown,
): ProposalDocumentContent["locales"] => {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const es = parseLocaleContentBlock(record.es);
  return es ? { es } : undefined;
};

const parseCustomSections = (raw: unknown): ProposalCustomSection[] | undefined => {
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
      };
    })
    .filter((row): row is ProposalCustomSection => row != null);
  return sections.length > 0 ? sections : undefined;
};
