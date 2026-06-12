export const PROPOSAL_DOCUMENT_SECTIONS = [
  { id: "intro", label: "Introduction" },
  { id: "includes", label: "What's included" },
  { id: "investment", label: "Investment" },
  { id: "warranty", label: "Warranty" },
  { id: "accept", label: "Accept" },
] as const;

/** Spanish labels for LBS proposal document sidebar (prototype). */
export const PROPOSAL_DOCUMENT_SECTIONS_ES = [
  { id: "intro", label: "Introducción" },
  { id: "includes", label: "Qué incluye" },
  { id: "investment", label: "Inversión" },
  { id: "warranty", label: "Garantía" },
  { id: "accept", label: "Aceptar" },
] as const;

export type ProposalDocumentSectionId =
  (typeof PROPOSAL_DOCUMENT_SECTIONS)[number]["id"];

export type ProposalPortfolioItem = {
  id: string;
  title: string;
  subtitle: string;
  image_url?: string | null;
};

export type ProposalTeamMember = {
  id: string;
  name: string;
  role: string;
  /** Short bio shown under name and role (about-us team grid). */
  bio?: string;
  image_url?: string | null;
};

/** Client / partner logo for the work-reviews section. */
export type ProposalClientLogo = {
  id: string;
  /** Optional label (accessibility / PDF). */
  name?: string;
  image_url?: string | null;
};

export type ProposalCustomSection = {
  id: string;
  title: string;
  body: string;
  /** Public URL or uploaded attachments URL for section visual. */
  image_url?: string | null;
};

export type ProposalAboutStats = {
  websites?: string;
  years?: string;
  leads?: string;
  retention?: string;
};

export type ProposalTimelineBar = {
  id: string;
  label: string;
  week_label: string;
  left_percent: number;
  width_percent: number;
  tone: "light" | "brand" | "dark" | "gold";
};

export type ProposalLocaleContentBlock = {
  hero_title?: string;
  hero_subtitle?: string;
  hero_image_url?: string | null;
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
  hero_image_url_es?: string | null;
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
  /** Portfolio tiles for work-reviews section (up to 3). */
  portfolio_items?: ProposalPortfolioItem[];
  /** Team grid on about-us. */
  team_members?: ProposalTeamMember[];
  /** Partner / client logos (work-reviews). */
  client_logos?: ProposalClientLogo[];
  /** Round profile photo beside intro signatory name. */
  intro_signatory_image_url?: string | null;
  /** Name on the intro letter (proposal contact — not the logged-in CRM user). */
  intro_signatory_name?: string;
  /** Company line under signatory name on the intro letter. */
  intro_signatory_company?: string;
  /** @deprecated Use intro_signatory_name; kept for older saved proposals. */
  intro_signatory_bio?: string;
  about_stats?: ProposalAboutStats;
  /** Gantt bars for project timeline section. */
  timeline_bars?: ProposalTimelineBar[];
  /**
   * Canonical deck copy revision. When lower than `PROPOSAL_DECK_REVISION`,
   * `hydrateProposalContent` replaces `custom_sections` from the template preset.
   */
  deck_revision?: number;
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
  warranty_title: "",
  warranty_body: "",
});

export {
  parseProposalContent,
  proposalContentSnapshot,
} from "@/modules/proposals/document/proposalContentParsers";
