import type { ProposalDeckPresetId } from "@/modules/proposals/document/proposalDeckSectionOrder";
import type { ProposalCustomSection } from "@/modules/proposals/document/proposalDocumentTypes";

type SectionSeed = Pick<ProposalCustomSection, "id" | "title" | "body">;

type DeckSeed = {
  narrative: SectionSeed[];
  timeline: SectionSeed;
};

const toSections = (seed: DeckSeed): ProposalCustomSection[] =>
  [...seed.narrative, seed.timeline].map((section) => ({
    ...section,
    image_url: "",
  }));

const WEBSITE_CONTRACTOR_EN: DeckSeed = {
  narrative: [
    {
      id: "about-us",
      title: "About Latinos Business Support",
      body:
        "Latinos Business Support (LBS) is a bilingual studio focused on contractors and home-service companies. We combine strategy, custom design, and development — not cookie-cutter templates — so {{empresa}} gets a site that reflects how you actually sell jobs in the field and at the office.\n\nWe have launched 120+ websites for trades across the U.S. Our work is built for speed on mobile, clarity for homeowners, and measurable lead generation in your service area.",
    },
    {
      id: "what-we-deliver",
      title: "What we deliver",
      body:
        "- Custom website for {{empresa}} — Mobile-first, fast-loading site coded for your services, service areas, and brand\n- Service & area pages — Dedicated pages that explain what you do and help you rank locally on Google\n- Conversion-focused CTAs — Click-to-call, SMS, and contact forms placed where prospects decide\n- On-page SEO foundation — Titles, meta descriptions, headings, and schema tuned for local search\n- Lead capture & routing — Forms connected to your email or CRM so nothing sits in a black hole\n- Launch & handoff — DNS, SSL, analytics, training, and a 30-day technical warranty on our work",
    },
    {
      id: "work-reviews",
      title: "Recent work & reviews",
      body:
        "Below are examples of contractor and home-service sites we have built — plus feedback from owners who partnered with LBS on design, build, and launch. Your project will follow the same standards: clear messaging, strong mobile experience, and tools your team can use after go-live.",
    },
    {
      id: "website-features",
      title: "Website features included",
      body:
        "- Performance — Optimized images, modern stack, and Core Web Vitals in mind so pages load fast on phones\n- Responsive design — Layouts that work on phone, tablet, and desktop without pinching or zooming\n- Service area pages — City or region pages when you cover multiple territories\n- Service detail pages — Room to explain scope, photos, FAQs, and why you vs. competitors\n- Click-to-call & SMS — One-tap contact options for homeowners on the go\n- Contact & quote forms — Custom fields and notifications to your inbox or CRM\n- Google Business Profile — Basic linking and local SEO hooks so web and GBP work together\n- Analytics & Search Console — GA4 setup so you can see traffic and conversions\n- Blog or gallery (optional) — Showcase projects, before/after, or seasonal offers",
    },
    {
      id: "process",
      title: "How we work",
      body:
        "1. Kickoff — Goals workshop, sitemap, brand assets, logins, and a shared checklist of what we need from your team (week 1)\n2. Design — Wireframes and visual mockups for key pages; up to two revision rounds on the agreed scope\n3. Build — Development, content placement, forms, and internal QA on staging\n4. Review — Your team tests staging; we implement feedback before anything goes live\n5. Launch — DNS, SSL, redirects if needed, final checks, training, and post-launch monitoring",
    },
    {
      id: "content-management",
      title: "After launch: your content tools",
      body:
        "You should not need us for every text or photo change. We configure editing access at a level your team is comfortable with — from guided CMS editing to lightweight updates on select pages.\n\nOptional monthly care covers small content changes, SEO tune-ups, and new landing pages when you want a partner on call instead of DIY.",
    },
  ],
  timeline: {
    id: "timeline",
    title: "From kickoff to launch in ~5 weeks",
    body: "",
  },
};

const WEBSITE_CONTRACTOR_ES: DeckSeed = {
  narrative: [
    {
      id: "about-us",
      title: "Sobre Latinos Business Support",
      body:
        "Latinos Business Support (LBS) es un estudio bilingüe enfocado en contratistas y empresas de servicios del hogar. Combinamos estrategia, diseño a medida y desarrollo — no plantillas genéricas — para que {{empresa}} tenga un sitio que refleje cómo vendes trabajos en campo y en oficina.\n\nHemos lanzado más de 120 sitios para oficios en EE.UU. Nuestro trabajo prioriza velocidad en móvil, claridad para el cliente y generación de leads medible en tu zona.",
    },
    {
      id: "what-we-deliver",
      title: "Qué entregamos",
      body:
        "- Sitio web a medida para {{empresa}} — Web mobile-first, rápida y codificada para tus servicios, zonas y marca\n- Páginas de servicios y áreas — Páginas dedicadas que explican qué haces y ayudan a posicionarte en Google local\n- CTAs de conversión — Llamar, SMS y formularios donde el prospecto decide\n- Base de SEO on-page — Títulos, meta, encabezados y schema para búsqueda local\n- Captura y enrutado de leads — Formularios a tu email o CRM para no perder consultas\n- Lanzamiento y entrega — DNS, SSL, analítica, capacitación y 30 días de garantía técnica por nuestro trabajo",
    },
    {
      id: "work-reviews",
      title: "Trabajos recientes y reseñas",
      body:
        "Abajo verás ejemplos de sitios para contratistas y servicios del hogar — y comentarios de dueños que trabajaron con LBS en diseño, build y lanzamiento. Tu proyecto seguirá los mismos estándares: mensaje claro, móvil sólido y herramientas que tu equipo puede usar después del go-live.",
    },
    {
      id: "website-features",
      title: "Funciones web incluidas",
      body:
        "- Rendimiento — Imágenes optimizadas, stack moderno y foco en Core Web Vitals para carga rápida en celular\n- Diseño responsive — Se ve bien en teléfono, tablet y escritorio\n- Páginas de área — Ciudades o regiones cuando cubres varios territorios\n- Páginas de servicio — Alcance, fotos, FAQs y por qué elegirte\n- Clic para llamar y SMS — Contacto en un toque para clientes en movimiento\n- Formularios de contacto — Campos y notificaciones a tu bandeja o CRM\n- Google Business Profile — Enlaces básicos y SEO local alineado con tu web\n- Analítica y Search Console — GA4 para ver tráfico y conversiones\n- Blog o galería (opcional) — Proyectos, antes/después u ofertas de temporada",
    },
    {
      id: "process",
      title: "Cómo trabajamos",
      body:
        "1. Kickoff — Taller de objetivos, mapa del sitio, marca, accesos y checklist de lo que necesitamos de tu equipo (semana 1)\n2. Diseño — Wireframes y mockups de páginas clave; hasta dos rondas de revisión en el alcance acordado\n3. Desarrollo — Build, contenido, formularios y QA interno en staging\n4. Revisión — Tu equipo prueba staging; aplicamos feedback antes del go-live\n5. Lanzamiento — DNS, SSL, redirecciones si aplica, chequeos finales, capacitación y monitoreo inicial",
    },
    {
      id: "content-management",
      title: "Después del lanzamiento: tus herramientas",
      body:
        "No deberías necesitarnos para cada cambio de texto o foto. Configuramos acceso de edición según la comodidad de tu equipo — desde CMS guiado hasta actualizaciones ligeras en páginas seleccionadas.\n\nEl cuidado mensual opcional cubre cambios pequeños, SEO y landings nuevas cuando prefieres un partner en lugar de hacerlo solo.",
    },
  ],
  timeline: {
    id: "timeline",
    title: "De kickoff a lanzamiento en ~5 semanas",
    body: "",
  },
};

export const PROPOSAL_DECK_BODY_BY_PRESET: Record<
  ProposalDeckPresetId,
  { en: DeckSeed; es: DeckSeed }
> = {
  "website-contractor": {
    en: WEBSITE_CONTRACTOR_EN,
    es: WEBSITE_CONTRACTOR_ES,
  },
  "website-redesign": {
    en: {
      ...WEBSITE_CONTRACTOR_EN,
      narrative: [
        {
          id: "about-us",
          title: "About us",
          body:
            "Latinos Business Support modernizes existing websites for {{empresa}} while protecting brand recognition and search visibility. We audit, redesign, and rebuild on a modern foundation so your team can update content without friction.",
        },
        {
          id: "what-we-deliver",
          title: "What we deliver",
          body:
            "- UX and performance audit of your current site\n- Updated design system and key page templates\n- Rebuild on a modern, fast stack\n- Content migration and redirects where needed\n- QA, launch, and post-launch monitoring",
        },
        {
          id: "guidelines",
          title: "Guidelines we follow",
          body:
            "- Preserve must-keep URLs and integrations you flag upfront\n- Redirect plan for SEO before launch\n- Two design revision rounds included unless noted\n- 30-day warranty on technical issues after go-live\n- Change requests outside scope quoted in writing",
        },
        {
          id: "website-features",
          title: "Website features we offer",
          body:
            "- Improved Core Web Vitals and mobile usability\n- Refreshed visual identity aligned with your brand\n- Clear conversion paths on service and contact pages\n- Analytics and Search Console setup\n- Optional blog, gallery, or landing pages",
        },
        {
          id: "process",
          title: "Process",
          body:
            "1. Audit workshop — current site, SEO, and goals\n2. Sitemap + design approval\n3. Build and content migration\n4. Staging review with your team\n5. Launch + redirect verification",
        },
        {
          id: "content-management",
          title: "Content management tools",
          body:
            "We configure editing access so your team can update pages after launch. Training walkthrough is included at handoff. Optional monthly care covers small updates and performance checks.",
        },
      ],
      timeline: {
        id: "timeline",
        title: "Project timeline",
        body:
          "Most redesigns complete in 3–6 weeks.\n\n- Week 1: Audit + sitemap\n- Weeks 2–3: Design + approval\n- Weeks 4–5: Development + migration\n- Week 6: Launch + handoff",
      },
    },
    es: {
      ...WEBSITE_CONTRACTOR_ES,
      narrative: [
        {
          id: "about-us",
          title: "Sobre nosotros",
          body:
            "Latinos Business Support moderniza sitios existentes para {{empresa}} protegiendo reconocimiento de marca y visibilidad en buscadores. Auditamos, rediseñamos y reconstruimos sobre una base moderna para que tu equipo actualice contenido sin fricción.",
        },
        {
          id: "what-we-deliver",
          title: "Qué entregamos",
          body:
            "- Auditoría UX y rendimiento del sitio actual\n- Sistema de diseño y plantillas de páginas clave\n- Reconstrucción en stack rápido y moderno\n- Migración de contenido y redirecciones necesarias\n- QA, lanzamiento y monitoreo inicial",
        },
        {
          id: "guidelines",
          title: "Lineamientos que seguimos",
          body:
            "- Conservar URLs e integraciones que indiques desde el inicio\n- Plan de redirecciones SEO antes del lanzamiento\n- Dos rondas de diseño incluidas salvo acuerdo\n- 30 días de garantía técnica post-lanzamiento\n- Cambios fuera de alcance cotizados por escrito",
        },
        {
          id: "website-features",
          title: "Funciones web que ofrecemos",
          body:
            "- Mejor Core Web Vitals y uso en móvil\n- Identidad visual alineada con tu marca\n- Rutas de conversión claras en servicios y contacto\n- Analítica y Search Console\n- Blog, galería o landings opcionales",
        },
        {
          id: "process",
          title: "Proceso",
          body:
            "1. Taller de auditoría — sitio, SEO y objetivos\n2. Mapa del sitio + aprobación de diseño\n3. Desarrollo y migración de contenido\n4. Revisión en staging con tu equipo\n5. Lanzamiento + verificación de redirecciones",
        },
        {
          id: "content-management",
          title: "Herramientas de gestión de contenido",
          body:
            "Configuramos acceso de edición para tu equipo después del lanzamiento. Incluye capacitación en la entrega. Cuidado mensual opcional para cambios menores y rendimiento.",
        },
      ],
      timeline: {
        id: "timeline",
        title: "Cronograma del proyecto",
        body:
          "La mayoría de rediseños se completan en 3–6 semanas.\n\n- Semana 1: Auditoría + mapa\n- Semanas 2–3: Diseño + aprobación\n- Semanas 4–5: Desarrollo + migración\n- Semana 6: Lanzamiento + entrega",
      },
    },
  },
  "digital-marketing": {
    en: {
      narrative: [
        {
          id: "about-us",
          title: "About us",
          body:
            "Latinos Business Support runs coordinated digital marketing for local and regional businesses like {{empresa}}. We align paid, organic, and reporting so you know what is working and what to adjust each month.",
        },
        {
          id: "what-we-deliver",
          title: "What we deliver",
          body:
            "- Channel strategy aligned to your package\n- Campaign setup, creative direction, and optimization\n- Landing page and tracking recommendations\n- Monthly performance report and review call\n- Ongoing testing and budget allocation guidance",
        },
        {
          id: "guidelines",
          title: "Guidelines we follow",
          body:
            "- You fund ad spend directly to platforms unless agreed otherwise\n- Brand guidelines and offers provided by your team\n- Defined approval window for ads and creative\n- Transparent reporting — no vanity metrics without context\n- Pause terms per your contract",
        },
        {
          id: "website-features",
          title: "Channels & capabilities",
          body:
            "- Google Ads and Local Services (as scoped)\n- Meta (Facebook / Instagram) campaigns\n- SEO and content recommendations\n- Conversion tracking and GA4 setup support\n- Creative and copy support per package",
        },
        {
          id: "process",
          title: "Process",
          body:
            "1. Onboarding — access, tracking, and baseline\n2. Launch — initial campaigns live\n3. Optimize — weekly monitoring, monthly report\n4. Review call — align on next tests and budget\n5. Quarterly strategy refresh",
        },
        {
          id: "content-management",
          title: "Content & assets",
          body:
            "We coordinate creative requests with your team. You provide brand assets, offers, and approvals; we handle trafficking, copy variants, and performance notes in your monthly report.",
        },
      ],
      timeline: {
        id: "timeline",
        title: "Engagement timeline",
        body:
          "- Month 1: Onboarding, tracking, initial campaigns\n- Months 2+: Optimize, test, scale winners\n- Ongoing: Weekly monitoring, monthly report\n- Quarterly: Strategy refresh with your team",
      },
    },
    es: {
      narrative: [
        {
          id: "about-us",
          title: "Sobre nosotros",
          body:
            "Latinos Business Support ejecuta marketing digital coordinado para negocios como {{empresa}}. Alineamos lo pagado, orgánico y reportes para que sepas qué funciona y qué ajustar cada mes.",
        },
        {
          id: "what-we-deliver",
          title: "Qué entregamos",
          body:
            "- Estrategia de canales según tu paquete\n- Configuración de campañas, creativos y optimización\n- Recomendaciones de landing y tracking\n- Reporte mensual y llamada de revisión\n- Pruebas continuas y guía de presupuesto",
        },
        {
          id: "guidelines",
          title: "Lineamientos que seguimos",
          body:
            "- Inversión en ads pagada directo a plataformas salvo acuerdo\n- Guías de marca y ofertas provistas por tu equipo\n- Ventana definida para aprobar anuncios y creativos\n- Reportes transparentes — sin métricas vanidosas sin contexto\n- Términos de pausa según tu contrato",
        },
        {
          id: "website-features",
          title: "Canales y capacidades",
          body:
            "- Google Ads y Local Services (según alcance)\n- Campañas en Meta (Facebook / Instagram)\n- Recomendaciones SEO y de contenido\n- Soporte de tracking y GA4\n- Creativos y copy según paquete",
        },
        {
          id: "process",
          title: "Proceso",
          body:
            "1. Onboarding — accesos, tracking y línea base\n2. Lanzamiento — campañas iniciales\n3. Optimización — monitoreo semanal, reporte mensual\n4. Llamada de revisión — próximas pruebas y presupuesto\n5. Refresco trimestral de estrategia",
        },
        {
          id: "content-management",
          title: "Contenido y activos",
          body:
            "Coordinamos pedidos creativos con tu equipo. Tú provees marca, ofertas y aprobaciones; nosotros el trafficking, variantes de copy y notas de rendimiento en el reporte mensual.",
        },
      ],
      timeline: {
        id: "timeline",
        title: "Cronograma del servicio",
        body:
          "- Mes 1: Onboarding, tracking, campañas iniciales\n- Mes 2+: Optimizar, probar, escalar\n- Continuo: Monitoreo semanal, reporte mensual\n- Trimestral: Refresco de estrategia",
      },
    },
  },
  skop: {
    en: {
      narrative: [
        {
          id: "about-us",
          title: "About us",
          body:
            "SKOP by Latinos Business Support helps restoration and insurance contractors like {{empresa}} capture scopes in the field and export accurate ESX (Xactimate) outputs with less rework.",
        },
        {
          id: "what-we-deliver",
          title: "What we deliver",
          body:
            "- SKOP platform access per your selected plan\n- User seats as quoted\n- Onboarding session(s) and documentation\n- Email support per plan tier\n- Optional training add-ons if selected",
        },
        {
          id: "guidelines",
          title: "Guidelines we follow",
          body:
            "- Primary admin contact designated on your side\n- Training scheduled in advance\n- Pilot jobs recommended in week two\n- Additional seats quoted before provisioning",
        },
        {
          id: "website-features",
          title: "Platform features",
          body:
            "- Field scope capture workflow\n- ESX export per plan features\n- User roles and seat management\n- Documentation and in-app guidance\n- Email support by tier",
        },
        {
          id: "process",
          title: "Process",
          body:
            "1. Account setup and user invites\n2. Kickoff training\n3. Pilot jobs with support\n4. Team rollout\n5. Ongoing support per plan",
        },
        {
          id: "content-management",
          title: "Documentation & training",
          body:
            "We provide docs and live onboarding. Optional premium training packages add hands-on sessions beyond standard onboarding.",
        },
      ],
      timeline: {
        id: "timeline",
        title: "Onboarding timeline",
        body:
          "- Day 1–3: Account setup + invites\n- Week 1: Kickoff training\n- Week 2: Pilot jobs with support\n- Ongoing: Email support per plan tier",
      },
    },
    es: {
      narrative: [
        {
          id: "about-us",
          title: "Sobre nosotros",
          body:
            "SKOP de Latinos Business Support ayuda a contratistas de restauración y seguros como {{empresa}} a capturar alcances en campo y exportar ESX (Xactimate) con menos retrabajo.",
        },
        {
          id: "what-we-deliver",
          title: "Qué entregamos",
          body:
            "- Acceso a SKOP según el plan elegido\n- Usuarios según cotización\n- Sesión(es) de onboarding y documentación\n- Soporte por email según nivel\n- Capacitación opcional si está incluida",
        },
        {
          id: "guidelines",
          title: "Lineamientos que seguimos",
          body:
            "- Contacto administrador principal en tu equipo\n- Capacitación agendada con anticipación\n- Trabajos piloto recomendados en la semana dos\n- Usuarios adicionales cotizados antes de activar",
        },
        {
          id: "website-features",
          title: "Funciones de la plataforma",
          body:
            "- Flujo de captura de alcance en campo\n- Exportación ESX según plan\n- Roles y gestión de usuarios\n- Documentación y guía en la app\n- Soporte por email según nivel",
        },
        {
          id: "process",
          title: "Proceso",
          body:
            "1. Configuración de cuenta e invitaciones\n2. Capacitación inicial\n3. Trabajos piloto con soporte\n4. Despliegue al equipo\n5. Soporte continuo según plan",
        },
        {
          id: "content-management",
          title: "Documentación y capacitación",
          body:
            "Entregamos documentación y onboarding en vivo. Paquetes premium opcionales agregan sesiones prácticas adicionales.",
        },
      ],
      timeline: {
        id: "timeline",
        title: "Cronograma de onboarding",
        body:
          "- Día 1–3: Configuración + invitaciones\n- Semana 1: Capacitación inicial\n- Semana 2: Pilotos con soporte\n- Continuo: Soporte por email según plan",
      },
    },
  },
  blank: {
    en: {
      narrative: [
        {
          id: "about-us",
          title: "About us",
          body:
            "Latinos Business Support partners with {{empresa}} on the services summarized in this proposal. We focus on clear scope, responsive communication, and deliverables you can use immediately.",
        },
        {
          id: "what-we-deliver",
          title: "What we deliver",
          body:
            "- Services and deliverables listed in your package and line items\n- Milestones aligned at kickoff\n- Documentation and handoff as described in our discussions\n- Support channels defined for your engagement",
        },
        {
          id: "guidelines",
          title: "Guidelines we follow",
          body:
            "- Written scope before work begins\n- Change requests outside scope quoted separately\n- Timely feedback from your point of contact\n- Deliverables per the terms in your agreement",
        },
        {
          id: "website-features",
          title: "Capabilities included",
          body:
            "- See line items and package description for specific features\n- Add-ons available when you need to expand scope\n- Integrations quoted when not included in base package",
        },
        {
          id: "process",
          title: "Process",
          body:
            "1. Kickoff — align scope, contacts, and timeline\n2. Execution — per agreed milestones\n3. Review — your feedback and approvals\n4. Delivery — final assets and sign-off",
        },
        {
          id: "content-management",
          title: "Tools & handoff",
          body:
            "We document access, credentials, and how to maintain what we deliver. Recurring services include cadence defined at kickoff.",
        },
      ],
      timeline: {
        id: "timeline",
        title: "Project timeline",
        body:
          "Dates confirmed at kickoff based on availability.\n\n- Kickoff: align scope and contacts\n- Execution: agreed milestones\n- Review: feedback and approvals\n- Closeout: delivery and sign-off",
      },
    },
    es: {
      narrative: [
        {
          id: "about-us",
          title: "Sobre nosotros",
          body:
            "Latinos Business Support trabaja con {{empresa}} en los servicios resumidos en esta propuesta. Nos enfocamos en alcance claro, comunicación ágil y entregables listos para usar.",
        },
        {
          id: "what-we-deliver",
          title: "Qué entregamos",
          body:
            "- Servicios y entregables de tu paquete y líneas de cotización\n- Hitos alineados en el kickoff\n- Documentación y entrega según lo acordado\n- Canales de soporte definidos para tu proyecto",
        },
        {
          id: "guidelines",
          title: "Lineamientos que seguimos",
          body:
            "- Alcance por escrito antes de iniciar\n- Cambios fuera de alcance cotizados por separado\n- Feedback oportuno de tu contacto\n- Entregables según tu acuerdo",
        },
        {
          id: "website-features",
          title: "Capacidades incluidas",
          body:
            "- Ver líneas y descripción del paquete para funciones específicas\n- Add-ons cuando necesites ampliar alcance\n- Integraciones cotizadas si no están en el paquete base",
        },
        {
          id: "process",
          title: "Proceso",
          body:
            "1. Kickoff — alcance, contactos y cronograma\n2. Ejecución — hitos acordados\n3. Revisión — feedback y aprobaciones\n4. Entrega — activos finales y conformidad",
        },
        {
          id: "content-management",
          title: "Herramientas y entrega",
          body:
            "Documentamos accesos y cómo mantener lo entregado. Servicios recurrentes con ritmo definido en kickoff.",
        },
      ],
      timeline: {
        id: "timeline",
        title: "Cronograma del proyecto",
        body:
          "Fechas confirmadas en kickoff según disponibilidad.\n\n- Kickoff: alcance y contactos\n- Ejecución: hitos acordados\n- Revisión: feedback y aprobaciones\n- Cierre: entrega y conformidad",
      },
    },
  },
};

export const buildProposalDeckSections = (
  presetId: ProposalDeckPresetId,
): { en: ProposalCustomSection[]; es: ProposalCustomSection[] } => {
  const preset = PROPOSAL_DECK_BODY_BY_PRESET[presetId];
  return {
    en: toSections(preset.en),
    es: toSections(preset.es),
  };
};
