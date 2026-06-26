import type { ProposalDeckPresetId } from "@/modules/proposals/document/proposalTemplateSectionPresets";
import type { ProposalDocumentContent } from "@/modules/proposals/document/proposalDocumentTypes";

export type ProposalIntroCopy = {
  title: string;
  body: string;
};

type IntroLocalePair = {
  en: ProposalIntroCopy;
  es: ProposalIntroCopy;
};

const preamble = (title: string, paragraphs: string[]): ProposalIntroCopy => ({
  title,
  body: paragraphs.join("\n\n"),
});

/** Long-form introduction (letter-style) per template family — EN + ES. */
export const PROPOSAL_INTRO_PREAMBLES: Record<
  ProposalDeckPresetId,
  IntroLocalePair
> = {
  "website-contractor": {
    en: preamble("A partnership built for growth", [
      "Thank you for taking the time to review this proposal. It was prepared for {{empresa}} by Latinos Business Support after our conversation about strengthening your online presence and winning more of the right jobs in your market.",
      "We specialize in custom-coded websites for contractors and home-service businesses — not cookie-cutter templates. Our work is designed to load fast on mobile, rank locally on Google, and make it effortless for prospects to call, text, or request a quote. The pages that follow turn that strategy into a concrete plan: what we will deliver, how long it typically takes, what we need from your team, and how investment is structured.",
      "Please read the sections in order. “What’s included” and the investment summary reflect the package and options you selected in our builder; one-time project fees are separate from any monthly services unless noted. The deck sections (overview, goals, scope, timeline, and FAQ) expand on how we work day to day. If anything does not match what you discussed, tell us before you sign — we would rather align now than adjust mid-project.",
      "When you are ready to move forward, accept and sign at the end of this document and confirm the deposit so we can schedule kickoff. Questions in the meantime? Reach out to {{preparada_por}} or your LBS contact. We are glad to clarify scope, timing, or pricing before work begins.",
    ]),
    es: preamble("Una alianza pensada para crecer", [
      "Gracias por dedicar tiempo a revisar esta propuesta. Fue preparada para {{empresa}} por Latinos Business Support después de nuestra conversación sobre fortalecer tu presencia en línea y ganar más trabajos adecuados en tu mercado.",
      "Nos especializamos en sitios web a medida para contratistas y servicios del hogar — no plantillas genéricas. Nuestro trabajo está diseñado para cargar rápido en el celular, posicionarse localmente en Google y facilitar que los prospectos llamen, escriban o pidan cotización. Las páginas siguientes convierten esa estrategia en un plan concreto: qué entregamos, cuánto suele tardar, qué necesitamos de tu equipo y cómo se estructura la inversión.",
      "Te sugerimos leer las secciones en orden. “Qué incluye” y el resumen de inversión reflejan el paquete y las opciones que elegiste en nuestro constructor; los honorarios únicos del proyecto son aparte de cualquier servicio mensual, salvo que se indique lo contrario. Las secciones del documento (resumen, objetivos, alcance, cronograma y preguntas frecuentes) amplían cómo trabajamos día a día. Si algo no coincide con lo conversado, avísanos antes de firmar — preferimos alinear ahora que corregir a mitad del proyecto.",
      "Cuando quieras avanzar, acepta y firma al final de este documento y confirma el depósito para agendar el kickoff. ¿Dudas antes de eso? Escríbenos a {{preparada_por}} o a tu contacto en LBS. Con gusto aclaramos alcance, tiempos o precios antes de iniciar.",
    ]),
  },

  "website-redesign": {
    en: preamble("Modernize without starting over", [
      "Thank you for considering Latinos Business Support for {{empresa}}'s website redesign. This document captures what we heard in discovery: where the current site helps you today, where it holds you back, and what a refreshed experience should accomplish for your brand and your pipeline.",
      "A redesign is more than a new coat of paint. We audit UX, performance, and search visibility; protect the equity you have already built (URLs, rankings, and brand recognition where possible); and rebuild on a modern foundation so your team can update content without friction. The sections below spell out goals, deliverables, timeline, and what we need from you to keep momentum.",
      "Use the investment and “What’s included” areas as the financial source of truth for this engagement. The narrative sections (overview through FAQ) explain how we sequence audit, design, build, migration, and launch. If your team has must-keep pages, integrations, or compliance requirements, flag them before signature so we can reflect them in the plan.",
      "Ready to proceed? Review the scope, accept and sign, and confirm the deposit to book your kickoff workshop. For questions about redirects, content, or timelines, contact {{preparada_por}} — we are here to make the transition smooth, not disruptive.",
    ]),
    es: preamble("Modernizar sin empezar de cero", [
      "Gracias por considerar a Latinos Business Support para el rediseño del sitio de {{empresa}}. Este documento resume lo que escuchamos en el descubrimiento: dónde el sitio actual te ayuda, dónde te frena y qué debe lograr una experiencia renovada para tu marca y tu embudo de ventas.",
      "Un rediseño es más que un cambio visual. Auditamos UX, rendimiento y visibilidad en buscadores; protegemos el valor que ya construiste (URLs, posiciones y reconocimiento de marca cuando es posible); y reconstruimos sobre una base moderna para que tu equipo actualice contenido sin fricción. Las secciones siguientes detallan objetivos, entregables, cronograma y qué necesitamos de ti para mantener el ritmo.",
      "Usa la inversión y “Qué incluye” como referencia financiera de este proyecto. Las secciones narrativas (resumen hasta preguntas frecuentes) explican cómo secuenciamos auditoría, diseño, desarrollo, migración y lanzamiento. Si hay páginas, integraciones o requisitos que deben conservarse, indícalos antes de firmar para reflejarlos en el plan.",
      "¿Listo para avanzar? Revisa el alcance, acepta y firma, y confirma el depósito para reservar el taller de kickoff. Para dudas sobre redirecciones, contenido o tiempos, contacta a {{preparada_por}} — estamos para que la transición sea fluida, no disruptiva.",
    ]),
  },

  "digital-marketing": {
    en: preamble("Growth you can measure", [
      "Thank you for reviewing this marketing proposal for {{empresa}}. Latinos Business Support prepared it to align channels, budget, and reporting with the outcomes you care about — more qualified leads, stronger local visibility, and clarity on what is working month to month.",
      "Digital marketing only works when strategy, creative, and data move together. This document explains which services are in scope for your package, how we onboard and optimize, what we need from your team (access, assets, approvals), and how ad spend is handled relative to our management fee. Paid media can move quickly; SEO and content compound over time — we call that out so expectations stay realistic.",
      "Treat the investment section as your financial summary and the following deck sections as the operating playbook: goals and KPIs, scope of services, cadence, FAQ, and next steps. If a channel or budget assumption changed since our last call, let us know before you sign so we can update the plan in writing.",
      "To get started, confirm channels and budget, accept and sign, and grant platform access so we can begin onboarding. Questions about reporting, creative, or timelines? {{preparada_por}} can walk you through any line item before you commit.",
    ]),
    es: preamble("Crecimiento que puedes medir", [
      "Gracias por revisar esta propuesta de marketing para {{empresa}}. Latinos Business Support la preparó para alinear canales, presupuesto y reportes con los resultados que te importan: más leads calificados, mayor visibilidad local y claridad sobre qué funciona mes a mes.",
      "El marketing digital funciona cuando estrategia, creatividad y datos avanzan juntos. Este documento explica qué servicios incluye tu paquete, cómo hacemos onboarding y optimización, qué necesitamos de tu equipo (accesos, activos, aprobaciones) y cómo se maneja la inversión en ads frente a nuestro fee de gestión. Lo pagado puede moverse rápido; SEO y contenido se construyen con el tiempo — lo decimos para mantener expectativas realistas.",
      "Toma la sección de inversión como tu resumen financiero y las secciones siguientes como el manual operativo: objetivos y KPIs, alcance, ritmo, preguntas frecuentes y próximos pasos. Si un canal o un supuesto de presupuesto cambió desde la última llamada, avísanos antes de firmar para actualizar el plan por escrito.",
      "Para comenzar, confirma canales y presupuesto, acepta y firma, y otorga acceso a las plataformas para iniciar el onboarding. ¿Preguntas sobre reportes, creativos o tiempos? {{preparada_por}} puede repasar cualquier línea antes de que te comprometas.",
    ]),
  },

  skop: {
    en: preamble("From field scope to ESX with confidence", [
      "Thank you for evaluating SKOP for {{empresa}}. This proposal describes the platform access, seats, and onboarding included in your selected plan — and how our team will help your estimators and field staff adopt a repeatable workflow from scope capture to ESX (Xactimate) output.",
      "Restoration and insurance contractors lose hours when scopes are inconsistent, photos are missing, or estimates require heavy rework. SKOP is built to standardize how scopes are captured in the field and exported accurately, so your office spends less time fixing line items and more time closing jobs. The sections below outline outcomes, what is included, onboarding timing, and support expectations for your tier.",
      "Subscription features, user counts, and any training add-ons are reflected in the line items and investment summary. The deck sections expand on goals, deliverables, and FAQ — use them as the operational companion to this letter. If your pilot team or seat count changed, tell us before signature so the agreement matches reality.",
      "When you are ready, confirm plan and seats, accept and sign, and complete payment to trigger account setup. For onboarding schedules or technical questions, contact {{preparada_por}} or SKOP support — we want your team productive in the first weeks, not the first months.",
    ]),
    es: preamble("Del alcance en campo al ESX con confianza", [
      "Gracias por evaluar SKOP para {{empresa}}. Esta propuesta describe el acceso a la plataforma, los usuarios y el onboarding incluidos en el plan que elegiste — y cómo nuestro equipo ayudará a tus estimadores y personal de campo a adoptar un flujo repetible desde la captura del alcance hasta la salida ESX (Xactimate).",
      "Los contratistas de restauración y seguros pierden horas cuando los alcances son inconsistentes, faltan fotos o los estimados requieren mucho retrabajo. SKOP está pensado para estandarizar la captura en campo y exportar con precisión, para que oficina dedique menos tiempo a corregir partidas y más a cerrar trabajos. Las secciones siguientes detallan resultados, qué incluye, tiempos de onboarding y expectativas de soporte según tu nivel.",
      "Las funciones de suscripción, cantidad de usuarios y add-ons de capacitación se reflejan en las líneas y el resumen de inversión. Las secciones del documento amplían objetivos, entregables y preguntas frecuentes — úsalas como complemento operativo de esta carta. Si el equipo piloto o el número de usuarios cambió, avísanos antes de firmar para que el acuerdo coincida.",
      "Cuando estés listo, confirma plan y usuarios, acepta y firma, y completa el pago para activar la cuenta. Para agendas de onboarding o dudas técnicas, contacta a {{preparada_por}} o al soporte SKOP — queremos que tu equipo sea productivo en las primeras semanas, no en los primeros meses.",
    ]),
  },

  blank: {
    en: preamble("Thank you for the opportunity", [
      "Thank you for the opportunity to partner with {{empresa}}. Latinos Business Support prepared this proposal to document what we agreed to deliver, how success will be measured, and how investment and payments are structured — so everyone on your team has a single source of truth before work begins.",
      "Whether the engagement is a one-time project, an ongoing service, or a combination of both, the same principles apply: clear scope, timely approvals, and open communication. The introduction you are reading sets context; “What’s included” and the investment summary carry the commercial details; the custom sections that follow walk through goals, deliverables, timeline, and frequently asked questions in more depth.",
      "Figures and line items reflect your current selections in our proposal builder. Change requests outside this scope will be quoted in writing before we execute them. If you need a walkthrough of any section, your LBS representative can review it with you live.",
      "To proceed, review the full document, accept and sign when it matches your understanding, and submit the deposit per the payment schedule. Questions before then? Contact {{preparada_por}} — we would rather clarify now than surprise you later.",
    ]),
    es: preamble("Gracias por la oportunidad", [
      "Gracias por la oportunidad de trabajar con {{empresa}}. Latinos Business Support preparó esta propuesta para documentar lo que acordamos entregar, cómo mediremos el éxito y cómo se estructuran la inversión y los pagos — para que todo tu equipo tenga una sola fuente de verdad antes de iniciar.",
      "Ya sea un proyecto puntual, un servicio continuo o una combinación, aplican los mismos principios: alcance claro, aprobaciones oportunas y comunicación abierta. Esta introducción da contexto; “Qué incluye” y el resumen de inversión llevan los detalles comerciales; las secciones personalizadas que siguen profundizan en objetivos, entregables, cronograma y preguntas frecuentes.",
      "Las cifras y líneas reflejan tus selecciones actuales en nuestro constructor de propuestas. Los cambios fuera de este alcance se cotizarán por escrito antes de ejecutarlos. Si necesitas repasar alguna sección en vivo, tu representante LBS puede hacerlo contigo.",
      "Para avanzar, revisa el documento completo, acepta y firma cuando coincida con tu entendimiento, y envía el depósito según el plan de pagos. ¿Preguntas antes? Contacta a {{preparada_por}} — preferimos aclarar ahora que sorprender después.",
    ]),
  },
};

export const getProposalIntroPreamble = (
  slug: string,
): IntroLocalePair | null =>
  PROPOSAL_INTRO_PREAMBLES[slug as ProposalDeckPresetId] ?? null;

export const attachIntroPreamble = (
  slug: string,
  content: ProposalDocumentContent,
): ProposalDocumentContent => {
  const preset = getProposalIntroPreamble(slug);
  if (!preset) return content;
  return {
    ...content,
    intro_title: preset.en.title,
    intro_body: preset.en.body,
    locales: {
      ...content.locales,
      es: {
        ...content.locales?.es,
        intro_title: preset.es.title,
        intro_body: preset.es.body,
      },
    },
  };
};
