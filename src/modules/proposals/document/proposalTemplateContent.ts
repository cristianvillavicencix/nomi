import { attachIntroPreamble } from "@/modules/proposals/document/proposalIntroPreambles";
import {
  proposalNeedsFormalDeckRefresh,
  proposalUsesLegacyDeck,
} from "@/modules/proposals/document/proposalDeckSectionOrder";
import {
  PROPOSAL_DECK_REVISION,
  proposalNeedsDeckRevisionRefresh,
} from "@/modules/proposals/document/proposalDeckRevision";
import { attachProposalShowcaseDefaults } from "@/modules/proposals/document/proposalShowcaseDefaults";
import { DEFAULT_PROPOSAL_TEMPLATES } from "@/modules/proposals/document/proposalTemplateDefaults";
import {
  PROPOSAL_DECK_SECTIONS,
  type ProposalDeckPresetId,
} from "@/modules/proposals/document/proposalTemplateSectionPresets";
import type {
  ProposalDocumentContent,
  ProposalTemplate,
} from "@/modules/proposals/document/proposalDocumentTypes";
import { parseProposalContent } from "@/modules/proposals/document/proposalContentParsers";
import {
  mergeCommercialCopyFromPreset,
  stripLegacyWarranty,
} from "@/modules/proposals/document/proposalTemplateCommercialCopy";
import {
  buildProposalVariableContext,
  mergeProposalDocumentContent,
  type ProposalVariableContext,
} from "@/modules/proposals/document/proposalVariableMerge";

/** Saved intros shorter than this are treated as legacy stubs and refreshed from the template. */
const LEGACY_INTRO_MAX_CHARS = 220;

const isLegacyShortIntro = (body: string | undefined) => {
  const trimmed = body?.trim() ?? "";
  if (!trimmed) return true;
  if (trimmed.includes("\n\n")) return false;
  return trimmed.length < LEGACY_INTRO_MAX_CHARS;
};

export const getDefaultTemplateSeed = (slug: string) =>
  DEFAULT_PROPOSAL_TEMPLATES.find((seed) => seed.slug === slug);

export const buildCanonicalTemplateContent = (
  slug: string,
): ProposalDocumentContent | null => {
  const seed = getDefaultTemplateSeed(slug);
  if (!seed) return null;
  return parseProposalContent(seed.content);
};

export const hydrateProposalContent = (
  raw: unknown,
): ProposalDocumentContent => {
  const parsed = parseProposalContent(raw);
  const slug = parsed.template_slug as ProposalDeckPresetId | undefined;
  const deck = slug ? PROPOSAL_DECK_SECTIONS[slug] : undefined;

  const needsFreshDeck =
    !!deck &&
    (!(parsed.custom_sections ?? []).length ||
      proposalUsesLegacyDeck(parsed.custom_sections) ||
      proposalNeedsFormalDeckRefresh(parsed.custom_sections) ||
      proposalNeedsDeckRevisionRefresh(parsed));

  let content: ProposalDocumentContent = needsFreshDeck
    ? attachProposalShowcaseDefaults({
        ...parsed,
        custom_sections: deck.en,
        custom_sections_es: deck.es,
        deck_revision: PROPOSAL_DECK_REVISION,
      })
    : attachProposalShowcaseDefaults(parsed);

  const canonical = slug ? buildCanonicalTemplateContent(slug) : null;
  if (canonical && isLegacyShortIntro(parsed.intro_body)) {
    content = {
      ...content,
      intro_title: canonical.intro_title,
      intro_body: canonical.intro_body,
      locales: {
        ...content.locales,
        es: {
          ...content.locales?.es,
          intro_title: canonical.locales?.es?.intro_title,
          intro_body: canonical.locales?.es?.intro_body,
        },
      },
    };
  } else if (slug && isLegacyShortIntro(content.intro_body)) {
    content = attachIntroPreamble(slug, content);
  }

  if (slug) {
    content = mergeCommercialCopyFromPreset(slug, content);
  } else {
    content = stripLegacyWarranty(content);
  }

  if (slug && (content.custom_sections?.length ?? 0) > 0) {
    content = { ...content, deck_revision: PROPOSAL_DECK_REVISION };
  }

  return content;
};

export const buildContentForTemplate = (
  template: ProposalTemplate,
  variables: ProposalVariableContext,
): ProposalDocumentContent => {
  const canonical = buildCanonicalTemplateContent(template.slug);
  const base = canonical ?? attachIntroPreamble(
    template.slug,
    attachProposalShowcaseDefaults(parseProposalContent(template.content)),
  );

  return {
    ...mergeProposalDocumentContent(base, variables),
    template_id: Number(template.id),
    template_slug: template.slug,
    deck_revision: PROPOSAL_DECK_REVISION,
  };
};

export const buildContentForTemplateFromProposal = (
  template: ProposalTemplate,
  context: Parameters<typeof buildProposalVariableContext>[0],
): ProposalDocumentContent =>
  buildContentForTemplate(template, buildProposalVariableContext(context));
