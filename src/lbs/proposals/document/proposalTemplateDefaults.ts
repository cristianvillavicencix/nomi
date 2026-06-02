import type { ProposalTemplateContent } from "@/lbs/proposals/document/proposalDocumentTypes";
import { attachDeckSections } from "@/lbs/proposals/document/proposalTemplateSectionPresets";

export type DefaultProposalTemplateSeed = {
  name: string;
  slug: string;
  category: string;
  sort_order: number;
  content: ProposalTemplateContent;
};

const withDeck = (
  slug: Parameters<typeof attachDeckSections>[0],
  content: ProposalTemplateContent,
): ProposalTemplateContent => attachDeckSections(slug, content);

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
      intro_title: "Let's grow your business online",
      intro_body:
        "At Latinos Business Support we build custom-coded websites designed to help contractors like {{empresa}} show up first on Google, capture qualified leads, and look professional on every device.\n\nThis proposal summarizes the package and services we discussed. The investment and payment schedule reflect what you selected in our builder — one-time project fees are separate from any monthly services.",
      warranty_title: "Work with confidence",
      warranty_body:
        "We include 30 days of warranty on technical defects after delivery. Corrections for bugs or broken functionality introduced by our work are covered at no additional cost. Work begins after the deposit is received.",
      locales: {
        es: {
          hero_title: "Tu nuevo sitio web profesional",
          hero_subtitle:
            "Preparado para {{empresa}} por Latinos Business Support",
          intro_title: "Hagamos crecer tu negocio en línea",
          intro_body:
            "En Latinos Business Support construimos sitios web a medida para que contratistas como {{empresa}} aparezcan primero en Google, capturen clientes calificados y se vean profesionales en todos los dispositivos.\n\nEsta propuesta resume el paquete y los servicios que revisamos. La inversión y el plan de pagos reflejan lo que seleccionaste en nuestro constructor.",
          warranty_title: "Trabaja con confianza",
          warranty_body:
            "Incluimos 30 días de garantía por defectos técnicos después de la entrega. Las correcciones por errores introducidos por nuestro trabajo están cubiertas sin costo adicional. El trabajo comienza al recibir el depósito.",
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
      intro_title: "Refresh your brand online",
      intro_body:
        "We will redesign {{empresa}}'s existing site with a modern look, improved speed, and better conversion — keeping your domain and core SEO equity where possible.",
      warranty_title: "Post-launch support",
      warranty_body:
        "30-day warranty on technical issues after go-live. Additional change requests outside scope are quoted separately.",
      locales: {
        es: {
          hero_title: "Una presencia web más fuerte para {{empresa}}",
          hero_subtitle: "Propuesta de rediseño · Latinos Business Support",
          intro_title: "Renueva tu marca en línea",
          intro_body:
            "Rediseñaremos el sitio actual de {{empresa}} con un look moderno, mejor velocidad y más conversión — conservando tu dominio y el SEO posible.",
          warranty_title: "Soporte post-lanzamiento",
          warranty_body:
            "30 días de garantía por temas técnicos después del go-live. Cambios fuera de alcance se cotizan por separado.",
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
      intro_title: "Leads and visibility",
      intro_body:
        "This proposal covers ongoing marketing services for {{empresa}}. Ad spend is billed directly by the platforms unless otherwise noted.",
      warranty_title: "Reporting & optimization",
      warranty_body:
        "Monthly reporting and optimization are included per the selected package. Results depend on market, budget, and creative assets provided by the client.",
      locales: {
        es: {
          hero_title: "Crecimiento de marketing para {{empresa}}",
          hero_subtitle: "Propuesta de marketing digital · Latinos Business Support",
          intro_title: "Leads y visibilidad",
          intro_body:
            "Esta propuesta cubre servicios de marketing continuo para {{empresa}}. La inversión en ads se paga directo a las plataformas salvo acuerdo.",
          warranty_title: "Reportes y optimización",
          warranty_body:
            "Reportes y optimización mensual incluidos según el paquete. Los resultados dependen del mercado, presupuesto y creativos del cliente.",
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
      intro_title: "Scope to ESX, faster",
      intro_body:
        "SKOP helps {{empresa}} convert scopes to ESX (Xactimate) efficiently. This proposal covers subscription access and any onboarding listed below.",
      warranty_title: "Support",
      warranty_body:
        "Email support is included per your plan tier. Training sessions must be scheduled in advance.",
      locales: {
        es: {
          hero_title: "Acceso a la plataforma SKOP",
          hero_subtitle: "Preparado para {{empresa}} · Latinos Business Support",
          intro_title: "De alcance a ESX, más rápido",
          intro_body:
            "SKOP ayuda a {{empresa}} a convertir alcances a ESX (Xactimate) con eficiencia. Esta propuesta cubre suscripción y onboarding según tu paquete.",
          warranty_title: "Soporte",
          warranty_body:
            "Soporte por email incluido según tu plan. Las sesiones de capacitación se agendan con anticipación.",
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
      intro_title: "Introduction",
      intro_body:
        "Thank you for the opportunity to work with {{empresa}}. This document summarizes scope, investment, and next steps based on our conversations and the services you selected.",
      warranty_title: "Our commitment",
      warranty_body:
        "We stand behind the deliverables in this proposal per the terms in your agreement. Questions before signing? Contact your LBS representative anytime.",
      locales: {
        es: {
          hero_title: "Propuesta de servicios para {{empresa}}",
          hero_subtitle: "Preparado por Latinos Business Support",
          intro_title: "Introducción",
          intro_body:
            "Gracias por la oportunidad de trabajar con {{empresa}}. Este documento resume alcance, inversión y próximos pasos según lo conversado y los servicios que seleccionaste.",
          warranty_title: "Nuestro compromiso",
          warranty_body:
            "Respaldamos los entregables de esta propuesta según tu acuerdo. ¿Preguntas antes de firmar? Contacta a tu representante LBS.",
          accept_title: "Aceptar esta propuesta",
          accept_body:
            "Revisa los términos del contrato, confirma abajo y firma una sola vez.",
        },
      },
    }),
  },
];
