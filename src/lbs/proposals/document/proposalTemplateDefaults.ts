import type { ProposalTemplateContent } from "@/lbs/proposals/document/proposalDocumentTypes";
import { attachIntroPreamble } from "@/lbs/proposals/document/proposalIntroPreambles";
import { attachProposalShowcaseDefaults } from "@/lbs/proposals/document/proposalShowcaseDefaults";
import { mergeCommercialCopyFromPreset } from "@/lbs/proposals/document/proposalTemplateCommercialCopy";
import { attachDeckSections } from "@/lbs/proposals/document/proposalTemplateSectionPresets";
import type { ProposalDeckPresetId } from "@/lbs/proposals/document/proposalDeckSectionOrder";

export type DefaultProposalTemplateSeed = {
  name: string;
  slug: string;
  category: string;
  sort_order: number;
  content: ProposalTemplateContent;
};

const withDeck = (
  slug: ProposalDeckPresetId,
  content: ProposalTemplateContent,
): ProposalTemplateContent =>
  mergeCommercialCopyFromPreset(
    slug,
    attachProposalShowcaseDefaults(
      attachIntroPreamble(slug, attachDeckSections(slug, content)),
    ),
  );

export const DEFAULT_PROPOSAL_TEMPLATES: DefaultProposalTemplateSeed[] = [
  {
    name: "Website / Contractor",
    slug: "website-contractor",
    category: "web",
    sort_order: 1,
    content: withDeck("website-contractor", {
      template_slug: "website-contractor",
      hero_title: "Your new professional website",
      hero_subtitle:
        "Prepared for {{empresa}} by Latinos Business Support",
      locales: {
        es: {
          hero_title: "Tu nuevo sitio web profesional",
          hero_subtitle:
            "Preparado para {{empresa}} por Latinos Business Support",
          accept_title: "Accept this proposal",
          accept_body:
            "Review the contract terms, confirm below, and sign once. Your acceptance and signature are recorded together.",
        },
      },
    }),
  },
  {
    name: "Website redesign",
    slug: "website-redesign",
    category: "web",
    sort_order: 2,
    content: withDeck("website-redesign", {
      template_slug: "website-redesign",
      hero_title: "A stronger web presence for {{empresa}}",
      hero_subtitle: "Website redesign proposal · Latinos Business Support",
      locales: {
        es: {
          hero_title: "Una presencia web más fuerte para {{empresa}}",
          hero_subtitle: "Propuesta de rediseño · Latinos Business Support",
          accept_title: "Aceptar esta propuesta",
          accept_body:
            "Revisa los términos del contrato, confirma abajo y firma una sola vez.",
        },
      },
    }),
  },
  {
    name: "Digital marketing",
    slug: "digital-marketing",
    category: "marketing",
    sort_order: 3,
    content: withDeck("digital-marketing", {
      template_slug: "digital-marketing",
      hero_title: "Marketing growth for {{empresa}}",
      hero_subtitle: "Digital marketing proposal · Latinos Business Support",
      locales: {
        es: {
          hero_title: "Crecimiento de marketing para {{empresa}}",
          hero_subtitle: "Propuesta de marketing digital · Latinos Business Support",
          accept_title: "Aceptar esta propuesta",
          accept_body:
            "Revisa los términos del contrato, confirma abajo y firma una sola vez.",
        },
      },
    }),
  },
  {
    name: "SKOP",
    slug: "skop",
    category: "skop",
    sort_order: 4,
    content: withDeck("skop", {
      template_slug: "skop",
      hero_title: "SKOP platform access",
      hero_subtitle: "Prepared for {{empresa}} · Latinos Business Support",
      locales: {
        es: {
          hero_title: "Acceso a la plataforma SKOP",
          hero_subtitle: "Preparado para {{empresa}} · Latinos Business Support",
          accept_title: "Aceptar esta propuesta",
          accept_body:
            "Revisa los términos del contrato, confirma abajo y firma una sola vez.",
        },
      },
    }),
  },
  {
    name: "Blank",
    slug: "blank",
    category: "general",
    sort_order: 10,
    content: withDeck("blank", {
      template_slug: "blank",
      hero_title: "Service proposal for {{empresa}}",
      hero_subtitle: "Prepared by Latinos Business Support",
      locales: {
        es: {
          hero_title: "Propuesta de servicios para {{empresa}}",
          hero_subtitle: "Preparado por Latinos Business Support",
          accept_title: "Aceptar esta propuesta",
          accept_body:
            "Revisa los términos del contrato, confirma abajo y firma una sola vez.",
        },
      },
    }),
  },
];
