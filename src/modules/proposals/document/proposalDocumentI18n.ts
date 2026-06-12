export type ProposalLocale = "en" | "es";

export const PROPOSAL_LOCALE_KEY = "lbs.proposal.locale";

export type ProposalDocumentCopy = {
  languageToggle: string;
  serviceProposal: string;
  date: string;
  preparedBy: string;
  validFor: string;
  days: string;
  /** Short labels for the sidebar step list (client + editor). */
  nav: {
    intro: string;
    aboutUs: string;
    workReviews: string;
    whatWeDeliver: string;
    websiteFeatures: string;
    process: string;
    contentManagement: string;
    timeline: string;
    investment: string;
    accept: string;
    custom: string;
  };
  sections: {
    intro: string;
    includes: string;
    investment: string;
    warranty: string;
    terms: string;
    accept: string;
    custom: string;
    timeline: string;
    packageLines: string;
    aboutUs: string;
    workReviews: string;
    whatWeDeliver: string;
    websiteFeatures: string;
    process: string;
    contentManagement: string;
  };
  saveBeforeClientHint: string;
  deckUpdatedSaveHint: string;
  reviewsUnavailable: string;
  trustedByTitle: string;
  addClientLogo: string;
  clientLogosEmpty: string;
  clientLogoNamePlaceholder: string;
  signatoryBioPlaceholder: string;
  teamBioPlaceholder: string;
  teamSectionTitle: string;
  downloadPdf: string;
  includesTitle: string;
  includesSubtitle: string;
  basePackage: string;
  oneTime: string;
  noAddons: string;
  investmentDefaultTitle: string;
  oneTimePayment: string;
  recurringServices: string;
  totalInvestment: string;
  paymentsTitle: string;
  depositBadge: string;
  depositLabel: string;
  depositSub: string;
  installmentsLabel: (count: number) => string;
  installmentsSub: string;
  recurringLabel: string;
  recurringSub: string;
  stripeNote: string;
  termsDefaultTitle: string;
  termsEmpty: string;
  acceptDefaultTitle: string;
  acceptIntro: string;
  acceptProposal: string;
  acceptPending: string;
  signContract: string;
  signatoryName: string;
  signatoryPlaceholder: string;
  agreeTerms: string;
  agreeTermsPrefix: string;
  viewContractTermsLink: string;
  viewContractTerms: string;
  acceptAndSign: string;
  acceptAndSignPending: string;
  termsRequired: string;
  confirmDeposit: (amount: string) => string;
  signContractButton: string;
  signedOn: (date: string) => string;
  depositRecorded: string;
  previewAcceptDisabled: string;
  previewSignDisabled: string;
  /** Shown in PDF export instead of interactive accept buttons. */
  pdfAcceptNote: string;
  validUntil: string;
  loading: string;
  invalidLink: string;
  expiredLink: string;
  heroImageLabel: string;
  sectionImageLabel: string;
  sectionImageEmpty: string;
  sectionImageUrlPlaceholder: string;
  uploadSectionImage: string;
  removeSectionImage: string;
  introTitlePlaceholder: string;
  introBodyPlaceholder: string;
  introEditHint: string;
  introSignatoryNamePlaceholder: string;
  introSignatoryCompanyPlaceholder: string;
  introSignatoryHint: string;
  addSection: string;
  addDeliverable: string;
  addFeature: string;
  addStep: string;
  addTimelinePhase: string;
  timelinePhasePlaceholder: string;
  timelineWeekPlaceholder: string;
  removeItem: string;
};

const en: ProposalDocumentCopy = {
  languageToggle: "Español",
  serviceProposal: "Service proposal",
  date: "Date",
  preparedBy: "Prepared by",
  validFor: "Valid for",
  days: "days",
  nav: {
    intro: "Welcome",
    aboutUs: "About us",
    workReviews: "Our work",
    whatWeDeliver: "What you get",
    websiteFeatures: "Features",
    process: "How we work",
    contentManagement: "Your content",
    timeline: "Timeline",
    investment: "Pricing",
    accept: "Sign & accept",
    custom: "Section",
  },
  sections: {
    intro: "Opening letter",
    includes: "What's included",
    investment: "Investment",
    warranty: "Warranty",
    terms: "Terms",
    accept: "Accept",
    custom: "Section",
    timeline: "Project timeline",
    packageLines: "Package & line items",
    aboutUs: "About us",
    workReviews: "Work & reviews",
    whatWeDeliver: "What we deliver",
    websiteFeatures: "Website features",
    process: "Process",
    contentManagement: "Content management",
  },
  reviewsUnavailable:
    "Google reviews will appear here when VITE_LBS_GOOGLE_PLACE_ID is configured.",
  trustedByTitle: "Companies we've worked with",
  addClientLogo: "Add logo",
  clientLogosEmpty: "Upload client or partner logos (PNG/SVG with transparent background work best).",
  clientLogoNamePlaceholder: "Company name (optional)",
  signatoryBioPlaceholder:
    "Short bio — e.g. your role and how you support this project.",
  teamBioPlaceholder: "Short summary (2–3 sentences)",
  teamSectionTitle: "The team behind your project",
  downloadPdf: "Download PDF",
  includesTitle: "Your package and services",
  includesSubtitle:
    "Services included in this proposal.",
  basePackage: "Base package",
  oneTime: "one-time",
  noAddons: "No add-ons selected.",
  investmentDefaultTitle: "Summary and payment plan",
  oneTimePayment: "One-time payment",
  recurringServices: "Recurring services",
  totalInvestment: "Total project investment",
  paymentsTitle: "How payments would work",
  depositBadge: "50%",
  depositLabel: "Deposit on acceptance",
  depositSub: "To start the project",
  installmentsLabel: (count) => `${count} installment payments`,
  installmentsSub: "Automatic balance debit",
  recurringLabel: "Recurring services",
  recurringSub: "Monthly services",
  stripeNote: "Automatic debit (Stripe) when credentials are connected.",
  termsDefaultTitle: "Clear rules",
  termsEmpty: "Configure active contract terms in Settings → Commercial.",
  acceptDefaultTitle: "Accept this proposal",
  acceptIntro:
    "Review the proposal, then sign and pay your deposit on the secure acceptance page. We keep a full internal record of your signature and payment.",
  acceptProposal: "Accept proposal",
  acceptPending: "Processing…",
  signContract: "Sign contract",
  signatoryName: "Full legal name",
  signatoryPlaceholder: "Your full name",
  agreeTerms: "I have read and agree to the terms and conditions.",
  agreeTermsPrefix: "I have read and agree to the",
  viewContractTermsLink: "terms and conditions",
  viewContractTerms: "Contract terms",
  acceptAndSign: "Accept & sign contract",
  acceptAndSignPending: "Processing…",
  termsRequired:
    "Contract terms are not available yet. Please contact your LBS representative.",
  confirmDeposit: (amount) =>
    `I confirm the 50% deposit (${amount}) will be paid per the agreed method.`,
  signContractButton: "Sign contract",
  signedOn: (date) => `Contract signed on ${date}`,
  depositRecorded:
    "Deposit confirmation recorded. Our team will follow up shortly.",
  previewAcceptDisabled: "Preview only — this button works on the link we email you.",
  previewSignDisabled: "Available after you accept the proposal on your link.",
  pdfAcceptNote:
    "To accept, sign, and pay the deposit, use the secure proposal link we sent you (not this PDF).",
  validUntil: "Valid until",
  loading: "Loading proposal…",
  invalidLink: "Invalid proposal link.",
  expiredLink: "This proposal link is invalid or has expired.",
  heroImageLabel: "Hero image",
  sectionImageLabel: "Section image",
  sectionImageEmpty: "No image — paste a URL or upload a photo",
  sectionImageUrlPlaceholder: "https://… or upload below",
  uploadSectionImage: "Upload image",
  removeSectionImage: "Remove image",
  introTitlePlaceholder: "Opening headline",
  introBodyPlaceholder:
    "Write your opening letter… Leave a blank line between paragraphs.",
  introEditHint:
    "This letter sets context before scope and pricing. It adapts when you change templates.",
  introSignatoryNamePlaceholder: "Contact name on this letter",
  introSignatoryCompanyPlaceholder: "Organization (e.g. Latinos Business Support)",
  introSignatoryHint:
    "Shown on the intro letter only — the proposal contact, not your CRM login.",
  saveBeforeClientHint:
    "Unsaved changes — the client only sees the last saved version. Click Save before sending the link.",
  deckUpdatedSaveHint:
    "Deck sections were refreshed from your package type. Save once to store this version on the proposal.",
  addSection: "Add section",
  addDeliverable: "Add deliverable",
  addFeature: "Add feature",
  addStep: "Add step",
  addTimelinePhase: "Add phase",
  timelinePhasePlaceholder: "Phase name",
  timelineWeekPlaceholder: "Week label",
  removeItem: "Remove",
};

const es: ProposalDocumentCopy = {
  languageToggle: "English",
  serviceProposal: "Propuesta de servicios",
  date: "Fecha",
  preparedBy: "Preparado por",
  validFor: "Válida por",
  days: "días",
  nav: {
    intro: "Bienvenida",
    aboutUs: "Quiénes somos",
    workReviews: "Trabajos",
    whatWeDeliver: "Entregables",
    websiteFeatures: "Funciones",
    process: "Proceso",
    contentManagement: "Contenido",
    timeline: "Tiempos",
    investment: "Inversión",
    accept: "Firmar",
    custom: "Sección",
  },
  sections: {
    intro: "Carta de presentación",
    includes: "Qué incluye",
    investment: "Inversión",
    warranty: "Garantía",
    terms: "Términos",
    accept: "Aceptar",
    custom: "Sección",
    timeline: "Cronograma del proyecto",
    packageLines: "Paquete y líneas",
    aboutUs: "Sobre nosotros",
    workReviews: "Trabajos y reseñas",
    whatWeDeliver: "Qué entregamos",
    websiteFeatures: "Funciones web",
    process: "Proceso",
    contentManagement: "Gestión de contenido",
  },
  reviewsUnavailable:
    "Las reseñas de Google aparecerán aquí cuando VITE_LBS_GOOGLE_PLACE_ID esté configurado.",
  trustedByTitle: "Empresas con las que trabajamos",
  addClientLogo: "Añadir logo",
  clientLogosEmpty:
    "Sube logos de clientes o socios (PNG/SVG con fondo transparente funcionan mejor).",
  clientLogoNamePlaceholder: "Nombre de la empresa (opcional)",
  signatoryBioPlaceholder:
    "Bio breve — tu rol y cómo apoyas este proyecto.",
  teamBioPlaceholder: "Resumen breve (2–3 oraciones)",
  teamSectionTitle: "El equipo detrás de tu proyecto",
  downloadPdf: "Descargar PDF",
  includesTitle: "Tu paquete y servicios",
  includesSubtitle: "Servicios incluidos en esta propuesta.",
  basePackage: "Paquete base",
  oneTime: "único pago",
  noAddons: "Sin complementos seleccionados.",
  investmentDefaultTitle: "Resumen y plan de pagos",
  oneTimePayment: "Pago único",
  recurringServices: "Servicios recurrentes",
  totalInvestment: "Inversión total del proyecto",
  paymentsTitle: "Cómo funcionan los pagos",
  depositBadge: "50%",
  depositLabel: "Depósito al aceptar",
  depositSub: "Para iniciar el proyecto",
  installmentsLabel: (count) => `${count} pagos en cuotas`,
  installmentsSub: "Débito automático del saldo",
  recurringLabel: "Servicios recurrentes",
  recurringSub: "Servicios mensuales",
  stripeNote:
    "Débito automático (Stripe) cuando las credenciales estén conectadas.",
  termsDefaultTitle: "Reglas claras",
  termsEmpty:
    "Configura los términos del contrato activos en Ajustes → Comercial.",
  acceptDefaultTitle: "Aceptar esta propuesta",
  acceptIntro:
    "Revisa los términos del contrato, confirma abajo y firma una sola vez. La aceptación y la firma quedan registradas juntas.",
  acceptProposal: "Aceptar propuesta",
  acceptPending: "Procesando…",
  signContract: "Firmar contrato",
  signatoryName: "Nombre legal completo",
  signatoryPlaceholder: "Tu nombre completo",
  agreeTerms: "He leído y acepto los términos y condiciones.",
  agreeTermsPrefix: "He leído y acepto los",
  viewContractTermsLink: "términos y condiciones",
  viewContractTerms: "Términos del contrato",
  acceptAndSign: "Aceptar y firmar contrato",
  acceptAndSignPending: "Procesando…",
  termsRequired:
    "Los términos del contrato aún no están disponibles. Contacta a tu representante de LBS.",
  confirmDeposit: (amount) =>
    `Confirmo que el depósito del 50% (${amount}) se pagará según el método acordado.`,
  signContractButton: "Firmar contrato",
  signedOn: (date) => `Contrato firmado el ${date}`,
  depositRecorded:
    "Depósito registrado. Nuestro equipo se pondrá en contacto pronto.",
  previewAcceptDisabled:
    "Solo vista previa — este botón funciona en el enlace que te enviamos.",
  previewSignDisabled:
    "Disponible después de aceptar la propuesta en tu enlace.",
  pdfAcceptNote:
    "Para aceptar, firmar y pagar el depósito, usa el enlace seguro de la propuesta (no este PDF).",
  validUntil: "Válida hasta",
  loading: "Cargando propuesta…",
  invalidLink: "Enlace de propuesta no válido.",
  expiredLink: "Este enlace no es válido o ha expirado.",
  heroImageLabel: "Hero image",
  sectionImageLabel: "Section image",
  sectionImageEmpty: "No image — paste a URL or upload a photo",
  sectionImageUrlPlaceholder: "https://… or upload below",
  uploadSectionImage: "Subir imagen",
  removeSectionImage: "Quitar imagen",
  introTitlePlaceholder: "Título de la carta",
  introBodyPlaceholder:
    "Escribe la carta de presentación… Deja una línea en blanco entre párrafos.",
  introEditHint:
    "Esta carta da contexto antes del alcance y los precios. Cambia al elegir otra plantilla.",
  introSignatoryNamePlaceholder: "Nombre del contacto en esta carta",
  introSignatoryCompanyPlaceholder: "Organización (ej. Latinos Business Support)",
  introSignatoryHint:
    "Solo en la carta de intro — el contacto de la propuesta, no tu usuario del CRM.",
  saveBeforeClientHint:
    "Cambios sin guardar — el cliente solo ve la última versión guardada. Guarda antes de enviar el enlace.",
  deckUpdatedSaveHint:
    "Las secciones del deck se actualizaron según tu paquete. Guarda una vez para fijar esta versión en la propuesta.",
  addSection: "Añadir sección",
  addDeliverable: "Añadir entregable",
  addFeature: "Añadir función",
  addStep: "Añadir paso",
  addTimelinePhase: "Añadir fase",
  timelinePhasePlaceholder: "Nombre de la fase",
  timelineWeekPlaceholder: "Semanas",
  removeItem: "Quitar",
};

export const getProposalDocumentCopy = (locale: ProposalLocale): ProposalDocumentCopy =>
  locale === "es" ? es : en;

export const proposalDateLocale = (locale: ProposalLocale) =>
  locale === "es" ? "es-US" : "en-US";
