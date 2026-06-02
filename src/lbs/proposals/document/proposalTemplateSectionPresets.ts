import type { ProposalCustomSection } from "@/lbs/proposals/document/proposalDocumentTypes";

export type ProposalDeckPresetId =
  | "website-contractor"
  | "website-redesign"
  | "digital-marketing"
  | "skop"
  | "blank";

type DeckCopy = {
  en: ProposalCustomSection[];
  es: ProposalCustomSection[];
};

const deck = (
  en: ProposalCustomSection[],
  es: ProposalCustomSection[],
): DeckCopy => ({ en, es });

/** Professional proposal deck sections (EN + ES) per template family. */
export const PROPOSAL_DECK_SECTIONS: Record<ProposalDeckPresetId, DeckCopy> = {
  "website-contractor": deck(
    [
      {
        id: "overview",
        title: "Project overview",
        body:
          "This project delivers a fast, modern website that helps {{empresa}} win more local jobs.\n\nWe will design and build a site that looks great, loads quickly, and makes it easy for prospects to contact you.",
      },
      {
        id: "goals",
        title: "Goals & outcomes",
        body:
          "- Look professional on mobile and desktop\n- Rank better locally on Google\n- Convert more calls and form leads\n- Make it easy to update and expand over time",
      },
      {
        id: "scope",
        title: "Scope of work",
        body:
          "- Strategy + page structure\n- Design direction (modern, contractor-friendly)\n- Development (responsive, optimized)\n- Basic on-page SEO\n- Contact form + call-to-action sections\n- Launch support",
      },
      {
        id: "timeline",
        title: "Timeline",
        body:
          "Typical timeline is 2–4 weeks depending on content and approvals.\n\n- Week 1: Kickoff + structure\n- Week 2: Design + revisions\n- Week 3: Build + content\n- Week 4: QA + launch",
      },
      {
        id: "requirements",
        title: "What we need from you",
        body:
          "- Logo (or we can help)\n- Service list and service areas\n- Photos (project photos preferred)\n- Access to your domain (if existing)\n- A point of contact for approvals",
      },
      {
        id: "support",
        title: "Ongoing support (optional)",
        body:
          "If you choose a monthly plan, we can help with updates, content changes, SEO improvements, and ongoing optimization.",
      },
      {
        id: "faq",
        title: "FAQ",
        body:
          "**When do we start?** After the deposit is confirmed.\n\n**Who owns the website?** You do.\n\n**Can we add pages later?** Yes — we can scope add-ons any time.",
      },
      {
        id: "next",
        title: "Next steps",
        body:
          "1. Review the proposal\n2. Accept & sign\n3. Pay the deposit\n4. Kickoff call + start building",
      },
    ],
    [
      {
        id: "overview",
        title: "Resumen del proyecto",
        body:
          "Este proyecto entrega un sitio web rápido y moderno para que {{empresa}} gane más trabajos locales.\n\nDiseñamos y construimos un sitio que se ve profesional, carga rápido y convierte visitantes en llamadas y mensajes.",
      },
      {
        id: "goals",
        title: "Objetivos y resultados",
        body:
          "- Verse profesional en celular y computadora\n- Mejorar el posicionamiento local en Google\n- Convertir más llamadas y formularios\n- Poder crecer y agregar páginas con el tiempo",
      },
      {
        id: "scope",
        title: "Alcance del trabajo",
        body:
          "- Estrategia + estructura de páginas\n- Dirección de diseño (moderno, para contratistas)\n- Desarrollo (responsive y optimizado)\n- SEO básico on-page\n- Formulario de contacto + secciones de llamada a la acción\n- Soporte de lanzamiento",
      },
      {
        id: "timeline",
        title: "Cronograma",
        body:
          "El tiempo típico es 2–4 semanas según el contenido y aprobaciones.\n\n- Semana 1: Kickoff + estructura\n- Semana 2: Diseño + revisiones\n- Semana 3: Desarrollo + contenido\n- Semana 4: QA + lanzamiento",
      },
      {
        id: "requirements",
        title: "Qué necesitamos de ti",
        body:
          "- Logo (o te ayudamos)\n- Lista de servicios y áreas\n- Fotos (mejor si son de tus proyectos)\n- Acceso al dominio (si ya existe)\n- Un punto de contacto para aprobar",
      },
      {
        id: "support",
        title: "Soporte mensual (opcional)",
        body:
          "Si eliges un plan mensual, te ayudamos con cambios, contenido, mejoras de SEO y optimización continua.",
      },
      {
        id: "faq",
        title: "Preguntas frecuentes",
        body:
          "**¿Cuándo empezamos?** Después de confirmar el depósito.\n\n**¿De quién es el sitio?** Es tuyo.\n\n**¿Podemos agregar páginas después?** Sí — podemos cotizar add-ons cuando quieras.",
      },
      {
        id: "next",
        title: "Próximos pasos",
        body:
          "1. Revisar la propuesta\n2. Aceptar y firmar\n3. Pagar el depósito\n4. Llamada kickoff + iniciar el proyecto",
      },
    ],
  ),

  "website-redesign": deck(
    [
      {
        id: "overview",
        title: "Redesign overview",
        body:
          "We will modernize {{empresa}}'s existing website while protecting your brand equity and search visibility.\n\nThe focus is a cleaner experience, faster performance, and clearer paths to contact or request a quote.",
      },
      {
        id: "goals",
        title: "Goals & outcomes",
        body:
          "- Refresh visual identity without losing recognition\n- Improve Core Web Vitals and mobile usability\n- Increase conversion on key pages\n- Simplify content updates going forward",
      },
      {
        id: "scope",
        title: "Scope of work",
        body:
          "- Audit of current site (UX, SEO, performance)\n- New design system + key page templates\n- Rebuild on modern stack\n- Content migration + redirects where needed\n- QA, launch, and post-launch monitoring",
      },
      {
        id: "timeline",
        title: "Timeline",
        body:
          "Most redesigns complete in 3–6 weeks.\n\n- Week 1: Audit + sitemap\n- Weeks 2–3: Design + approval\n- Weeks 4–5: Development + migration\n- Week 6: Launch + handoff",
      },
      {
        id: "requirements",
        title: "What we need from you",
        body:
          "- Brand assets and style preferences\n- Access to current site and analytics\n- Updated copy or approval of our drafts\n- List of must-keep URLs and integrations",
      },
      {
        id: "support",
        title: "Post-launch care (optional)",
        body:
          "Optional monthly care plans cover small updates, performance checks, and SEO tune-ups after go-live.",
      },
      {
        id: "faq",
        title: "FAQ",
        body:
          "**Will we lose Google rankings?** We plan redirects and preserve SEO best practices.\n\n**Can we keep the same domain?** Yes.\n\n**How many design rounds?** Two revision rounds are included unless noted otherwise.",
      },
      {
        id: "next",
        title: "Next steps",
        body:
          "1. Review scope and investment\n2. Accept & sign\n3. Confirm deposit\n4. Kickoff + audit workshop",
      },
    ],
    [
      {
        id: "overview",
        title: "Resumen del rediseño",
        body:
          "Modernizaremos el sitio actual de {{empresa}} protegiendo tu marca y visibilidad en buscadores.\n\nEl foco es una experiencia más clara, mejor rendimiento y rutas más directas para contactar o pedir cotización.",
      },
      {
        id: "goals",
        title: "Objetivos y resultados",
        body:
          "- Renovar la imagen sin perder reconocimiento\n- Mejorar rendimiento y uso en móvil\n- Aumentar conversión en páginas clave\n- Facilitar actualizaciones de contenido",
      },
      {
        id: "scope",
        title: "Alcance del trabajo",
        body:
          "- Auditoría del sitio (UX, SEO, rendimiento)\n- Nuevo sistema de diseño + plantillas\n- Reconstrucción en stack moderno\n- Migración de contenido + redirecciones\n- QA, lanzamiento y monitoreo inicial",
      },
      {
        id: "timeline",
        title: "Cronograma",
        body:
          "La mayoría de rediseños se completan en 3–6 semanas.\n\n- Semana 1: Auditoría + mapa del sitio\n- Semanas 2–3: Diseño + aprobación\n- Semanas 4–5: Desarrollo + migración\n- Semana 6: Lanzamiento + entrega",
      },
      {
        id: "requirements",
        title: "Qué necesitamos de ti",
        body:
          "- Activos de marca y preferencias de estilo\n- Acceso al sitio actual y analítica\n- Textos actualizados o aprobación de borradores\n- URLs e integraciones que deben conservarse",
      },
      {
        id: "support",
        title: "Cuidado post-lanzamiento (opcional)",
        body:
          "Planes mensuales opcionales cubren cambios menores, revisión de rendimiento y ajustes de SEO.",
      },
      {
        id: "faq",
        title: "Preguntas frecuentes",
        body:
          "**¿Perderemos posiciones en Google?** Planificamos redirecciones y buenas prácticas SEO.\n\n**¿Mantenemos el mismo dominio?** Sí.\n\n**¿Cuántas rondas de diseño?** Dos rondas de revisión incluidas salvo que se indique otra cosa.",
      },
      {
        id: "next",
        title: "Próximos pasos",
        body:
          "1. Revisar alcance e inversión\n2. Aceptar y firmar\n3. Confirmar depósito\n4. Kickoff + taller de auditoría",
      },
    ],
  ),

  "digital-marketing": deck(
    [
      {
        id: "overview",
        title: "Engagement overview",
        body:
          "This engagement helps {{empresa}} grow visibility, leads, and revenue through coordinated digital marketing.\n\nWe align channels, messaging, and reporting so you always know what is working.",
      },
      {
        id: "goals",
        title: "Goals & KPIs",
        body:
          "- Increase qualified leads month over month\n- Improve cost per lead on paid channels\n- Strengthen brand presence locally\n- Clear monthly reporting you can act on",
      },
      {
        id: "scope",
        title: "Scope of services",
        body:
          "- Channel strategy (as selected in your package)\n- Campaign setup and optimization\n- Creative direction + ad copy support\n- Landing page recommendations\n- Monthly performance report + review call",
      },
      {
        id: "timeline",
        title: "Timeline & cadence",
        body:
          "- Month 1: Onboarding, tracking, initial campaigns\n- Months 2+: Optimize, test, scale winners\n- Ongoing: Weekly monitoring, monthly report\n- Quarterly: Strategy refresh with your team",
      },
      {
        id: "requirements",
        title: "What we need from you",
        body:
          "- Platform access (Google, Meta, etc. as applicable)\n- Brand guidelines and offers\n- Approval window for ads and creative\n- Ad spend funded directly to platforms (unless noted)",
      },
      {
        id: "support",
        title: "Reporting & optimization",
        body:
          "Your package includes ongoing optimization and a monthly report. We recommend a 30-minute review call each month to align on next actions.",
      },
      {
        id: "faq",
        title: "FAQ",
        body:
          "**Who pays ad spend?** Typically {{empresa}} pays platforms directly.\n\n**How fast will we see results?** Paid can move quickly; SEO and content build over time.\n\n**Can we pause?** Yes — notice terms are in your contract.",
      },
      {
        id: "next",
        title: "Next steps",
        body:
          "1. Confirm channels and budget\n2. Accept & sign\n3. Grant platform access\n4. Kickoff + go live",
      },
    ],
    [
      {
        id: "overview",
        title: "Resumen del servicio",
        body:
          "Este servicio ayuda a {{empresa}} a crecer visibilidad, leads e ingresos con marketing digital coordinado.\n\nAlineamos canales, mensajes y reportes para que siempre sepas qué funciona.",
      },
      {
        id: "goals",
        title: "Objetivos y KPIs",
        body:
          "- Aumentar leads calificados mes a mes\n- Mejorar costo por lead en canales pagos\n- Fortalecer presencia de marca local\n- Reportes mensuales accionables",
      },
      {
        id: "scope",
        title: "Alcance de servicios",
        body:
          "- Estrategia de canales (según tu paquete)\n- Configuración y optimización de campañas\n- Dirección creativa + apoyo en copy\n- Recomendaciones de landing pages\n- Reporte mensual + llamada de revisión",
      },
      {
        id: "timeline",
        title: "Cronograma y ritmo",
        body:
          "- Mes 1: Onboarding, tracking, campañas iniciales\n- Mes 2+: Optimizar, probar, escalar lo que funciona\n- Continuo: Monitoreo semanal, reporte mensual\n- Trimestral: Refresco de estrategia",
      },
      {
        id: "requirements",
        title: "Qué necesitamos de ti",
        body:
          "- Acceso a plataformas (Google, Meta, etc.)\n- Guías de marca y ofertas\n- Ventana de aprobación para anuncios\n- Inversión en ads pagada a las plataformas (salvo acuerdo)",
      },
      {
        id: "support",
        title: "Reportes y optimización",
        body:
          "Tu paquete incluye optimización continua y un reporte mensual. Recomendamos una llamada de 30 minutos cada mes.",
      },
      {
        id: "faq",
        title: "Preguntas frecuentes",
        body:
          "**¿Quién paga la inversión en ads?** Normalmente {{empresa}} paga directo a las plataformas.\n\n**¿Qué tan rápido vemos resultados?** Lo pagado puede moverse rápido; SEO y contenido toman tiempo.\n\n**¿Podemos pausar?** Sí — los términos de aviso están en tu contrato.",
      },
      {
        id: "next",
        title: "Próximos pasos",
        body:
          "1. Confirmar canales y presupuesto\n2. Aceptar y firmar\n3. Dar acceso a plataformas\n4. Kickoff + activación",
      },
    ],
  ),

  skop: deck(
    [
      {
        id: "overview",
        title: "Platform overview",
        body:
          "SKOP helps {{empresa}} turn field scopes into accurate ESX (Xactimate) outputs faster, with fewer errors and less rework.\n\nThis proposal covers platform access and onboarding listed in your package.",
      },
      {
        id: "goals",
        title: "Goals & outcomes",
        body:
          "- Reduce time from scope to ESX\n- Standardize scope capture in the field\n- Fewer estimate revisions downstream\n- Train your team on a repeatable workflow",
      },
      {
        id: "scope",
        title: "What's included",
        body:
          "- SKOP subscription (per selected tier)\n- User seats as quoted\n- Onboarding session(s) as listed\n- Documentation and email support\n- Optional training add-ons if selected",
      },
      {
        id: "timeline",
        title: "Onboarding timeline",
        body:
          "- Day 1–3: Account setup + invites\n- Week 1: Kickoff training\n- Week 2: Pilot jobs with support\n- Ongoing: Email support per plan tier",
      },
      {
        id: "requirements",
        title: "What we need from you",
        body:
          "- Primary admin contact\n- List of users and roles\n- Sample scopes for pilot (optional)\n- Scheduled training windows",
      },
      {
        id: "support",
        title: "Support & success",
        body:
          "Email support is included per your plan. Training and premium success options can be added if you need hands-on help beyond onboarding.",
      },
      {
        id: "faq",
        title: "FAQ",
        body:
          "**Is ESX export included?** Yes — per your plan features.\n\n**Can we add seats later?** Yes — we will quote additional seats.\n\n**Is training required?** Recommended for fastest adoption.",
      },
      {
        id: "next",
        title: "Next steps",
        body:
          "1. Confirm plan and seats\n2. Accept & sign\n3. Complete payment\n4. Onboarding kickoff",
      },
    ],
    [
      {
        id: "overview",
        title: "Resumen de la plataforma",
        body:
          "SKOP ayuda a {{empresa}} a convertir alcances de campo en salidas ESX (Xactimate) más rápido, con menos errores y menos retrabajo.\n\nEsta propuesta cubre acceso a la plataforma y onboarding según tu paquete.",
      },
      {
        id: "goals",
        title: "Objetivos y resultados",
        body:
          "- Reducir tiempo de alcance a ESX\n- Estandarizar captura de alcance en campo\n- Menos revisiones de estimados\n- Capacitar al equipo en un flujo repetible",
      },
      {
        id: "scope",
        title: "Qué incluye",
        body:
          "- Suscripción SKOP (según nivel)\n- Usuarios según cotización\n- Sesión(es) de onboarding\n- Documentación y soporte por email\n- Entrenamiento opcional si está incluido",
      },
      {
        id: "timeline",
        title: "Cronograma de onboarding",
        body:
          "- Día 1–3: Configuración de cuenta + invitaciones\n- Semana 1: Capacitación inicial\n- Semana 2: Trabajos piloto con soporte\n- Continuo: Soporte por email según plan",
      },
      {
        id: "requirements",
        title: "Qué necesitamos de ti",
        body:
          "- Contacto administrador principal\n- Lista de usuarios y roles\n- Alcances de muestra para piloto (opcional)\n- Horarios para capacitación",
      },
      {
        id: "support",
        title: "Soporte y éxito",
        body:
          "Soporte por email incluido según tu plan. Opciones premium de capacitación se pueden agregar si necesitas más ayuda.",
      },
      {
        id: "faq",
        title: "Preguntas frecuentes",
        body:
          "**¿Incluye exportación ESX?** Sí — según funciones de tu plan.\n\n**¿Podemos agregar usuarios después?** Sí — cotizamos asientos adicionales.\n\n**¿Es obligatorio el entrenamiento?** Recomendado para adopción más rápida.",
      },
      {
        id: "next",
        title: "Próximos pasos",
        body:
          "1. Confirmar plan y usuarios\n2. Aceptar y firmar\n3. Completar pago\n4. Kickoff de onboarding",
      },
    ],
  ),

  blank: deck(
    [
      {
        id: "overview",
        title: "Project overview",
        body:
          "This proposal outlines how Latinos Business Support will partner with {{empresa}} on the services summarized below.\n\nInvestment and schedule reflect the line items and payment plan you selected.",
      },
      {
        id: "goals",
        title: "Goals & outcomes",
        body:
          "- Deliver the agreed scope on time\n- Clear communication and approvals\n- Measurable results aligned with your business\n- A smooth handoff when complete",
      },
      {
        id: "scope",
        title: "Scope of work",
        body:
          "- Services listed in “What’s included” and line items\n- Deliverables as described in our discussions\n- Revisions per the terms in your contract\n- Change requests outside scope quoted separately",
      },
      {
        id: "timeline",
        title: "Timeline",
        body:
          "We will confirm dates at kickoff based on your availability and our capacity.\n\n- Kickoff: align scope and contacts\n- Execution: per agreed milestones\n- Review: your feedback and approvals\n- Closeout: delivery and sign-off",
      },
      {
        id: "requirements",
        title: "What we need from you",
        body:
          "- Timely feedback on deliverables\n- Access to systems or assets we need\n- A single point of contact for decisions\n- Deposit per the payment schedule",
      },
      {
        id: "support",
        title: "Ongoing support (if applicable)",
        body:
          "If your package includes recurring services, we will define cadence and channels during kickoff.",
      },
      {
        id: "faq",
        title: "FAQ",
        body:
          "**When does work start?** After deposit and signed agreement.\n\n**How do change requests work?** Quoted in writing before work begins.\n\n**Who owns deliverables?** As defined in your contract terms.",
      },
      {
        id: "next",
        title: "Next steps",
        body:
          "1. Review this proposal\n2. Accept & sign\n3. Pay deposit per schedule\n4. Schedule kickoff",
      },
    ],
    [
      {
        id: "overview",
        title: "Resumen del proyecto",
        body:
          "Esta propuesta describe cómo Latinos Business Support trabajará con {{empresa}} en los servicios resumidos abajo.\n\nLa inversión y el calendario reflejan los ítems y el plan de pagos que seleccionaste.",
      },
      {
        id: "goals",
        title: "Objetivos y resultados",
        body:
          "- Entregar el alcance acordado a tiempo\n- Comunicación y aprobaciones claras\n- Resultados alineados con tu negocio\n- Entrega ordenada al finalizar",
      },
      {
        id: "scope",
        title: "Alcance del trabajo",
        body:
          "- Servicios listados en “Qué incluye” y líneas de cotización\n- Entregables según lo acordado\n- Revisiones según tu contrato\n- Cambios fuera de alcance se cotizan por separado",
      },
      {
        id: "timeline",
        title: "Cronograma",
        body:
          "Confirmaremos fechas en el kickoff según disponibilidad.\n\n- Kickoff: alinear alcance y contactos\n- Ejecución: hitos acordados\n- Revisión: tu feedback y aprobaciones\n- Cierre: entrega y conformidad",
      },
      {
        id: "requirements",
        title: "Qué necesitamos de ti",
        body:
          "- Feedback oportuno en entregables\n- Acceso a sistemas o activos necesarios\n- Un contacto para decisiones\n- Depósito según el plan de pagos",
      },
      {
        id: "support",
        title: "Soporte continuo (si aplica)",
        body:
          "Si tu paquete incluye servicios recurrentes, definiremos ritmo y canales en el kickoff.",
      },
      {
        id: "faq",
        title: "Preguntas frecuentes",
        body:
          "**¿Cuándo empieza el trabajo?** Tras depósito y acuerdo firmado.\n\n**¿Cómo funcionan cambios de alcance?** Cotizados por escrito antes de ejecutar.\n\n**¿Quién es dueño de los entregables?** Según los términos del contrato.",
      },
      {
        id: "next",
        title: "Próximos pasos",
        body:
          "1. Revisar esta propuesta\n2. Aceptar y firmar\n3. Pagar depósito según plan\n4. Agendar kickoff",
      },
    ],
  ),
};

export const attachDeckSections = (
  slug: string,
  content: ProposalTemplateContent,
): ProposalTemplateContent => {
  const preset = PROPOSAL_DECK_SECTIONS[slug as ProposalDeckPresetId];
  if (!preset) return content;
  return {
    ...content,
    custom_sections: preset.en,
    custom_sections_es: preset.es,
  };
};
