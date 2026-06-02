import type { ProposalTemplateContent } from "@/lbs/proposals/document/proposalDocumentTypes";

export type DefaultProposalTemplateSeed = {
  name: string;
  slug: string;
  category: string;
  sort_order: number;
  content: ProposalTemplateContent;
};

export const DEFAULT_PROPOSAL_TEMPLATES: DefaultProposalTemplateSeed[] = [
  {
    name: "Website / Contractor",
    slug: "website-contractor",
    category: "web",
    sort_order: 1,
    content: {
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
          accept_title: "Aceptar esta propuesta",
          accept_body:
            "Al aceptar, confirmas los servicios y el calendario de pagos. Se generará un contrato para tu firma.",
        },
      },
    },
  },
  {
    name: "Website redesign",
    slug: "website-redesign",
    category: "web",
    sort_order: 2,
    content: {
      template_slug: "website-redesign",
      hero_title: "A stronger web presence for {{empresa}}",
      hero_subtitle: "Website redesign proposal",
      intro_title: "Refresh your brand online",
      intro_body:
        "We will redesign {{empresa}}'s existing site with a modern look, improved speed, and better conversion — keeping your domain and core SEO equity where possible.",
      warranty_title: "Post-launch support",
      warranty_body:
        "30-day warranty on technical issues after go-live. Additional change requests outside scope are quoted separately.",
    },
  },
  {
    name: "Digital marketing",
    slug: "digital-marketing",
    category: "marketing",
    sort_order: 3,
    content: {
      template_slug: "digital-marketing",
      hero_title: "Marketing growth for {{empresa}}",
      intro_title: "Leads and visibility",
      intro_body:
        "This proposal covers ongoing marketing services for {{empresa}}. Ad spend is billed directly by the platforms unless otherwise noted.",
      warranty_title: "Reporting & optimization",
      warranty_body:
        "Monthly reporting and optimization are included per the selected package. Results depend on market, budget, and creative assets provided by the client.",
    },
  },
  {
    name: "SKOP",
    slug: "skop",
    category: "skop",
    sort_order: 4,
    content: {
      template_slug: "skop",
      hero_title: "SKOP platform access",
      intro_title: "Scope to ESX, faster",
      intro_body:
        "SKOP helps {{empresa}} convert scopes to ESX (Xactimate) efficiently. This proposal covers subscription access and any onboarding listed below.",
      warranty_title: "Support",
      warranty_body:
        "Email support is included per your plan tier. Training sessions must be scheduled in advance.",
    },
  },
  {
    name: "Blank",
    slug: "blank",
    category: "general",
    sort_order: 10,
    content: {
      template_slug: "blank",
      hero_title: "Service proposal",
      intro_title: "Introduction",
      intro_body: "",
      warranty_title: "Warranty",
      warranty_body: "",
    },
  },
];
