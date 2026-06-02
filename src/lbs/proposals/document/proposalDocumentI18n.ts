export type ProposalLocale = "en" | "es";

export const PROPOSAL_LOCALE_KEY = "lbs.proposal.locale";

export type ProposalDocumentCopy = {
  languageToggle: string;
  serviceProposal: string;
  date: string;
  preparedBy: string;
  validFor: string;
  days: string;
  sections: {
    intro: string;
    includes: string;
    investment: string;
    warranty: string;
    terms: string;
    accept: string;
    custom: string;
  };
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
  confirmDeposit: (amount: string) => string;
  signContractButton: string;
  signedOn: (date: string) => string;
  depositRecorded: string;
  previewAcceptDisabled: string;
  previewSignDisabled: string;
  validUntil: string;
  loading: string;
  invalidLink: string;
  expiredLink: string;
};

const en: ProposalDocumentCopy = {
  languageToggle: "Español",
  serviceProposal: "Service proposal",
  date: "Date",
  preparedBy: "Prepared by",
  validFor: "Valid for",
  days: "days",
  sections: {
    intro: "Introduction",
    includes: "What's included",
    investment: "Investment",
    warranty: "Warranty",
    terms: "Terms",
    accept: "Accept",
    custom: "Section",
  },
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
    "By accepting, you agree to the services and payment schedule above. A contract will be generated for your signature.",
  acceptProposal: "Accept proposal",
  acceptPending: "Processing…",
  signContract: "Sign contract",
  signatoryName: "Full legal name",
  signatoryPlaceholder: "Your full name",
  agreeTerms: "I have read and agree to the terms and conditions.",
  confirmDeposit: (amount) =>
    `I confirm the 50% deposit (${amount}) will be paid per the agreed method.`,
  signContractButton: "Sign contract",
  signedOn: (date) => `Contract signed on ${date}`,
  depositRecorded:
    "Deposit confirmation recorded. Our team will follow up shortly.",
  previewAcceptDisabled: "Preview only — this button works on the link we email you.",
  previewSignDisabled: "Available after you accept the proposal on your link.",
  validUntil: "Valid until",
  loading: "Loading proposal…",
  invalidLink: "Invalid proposal link.",
  expiredLink: "This proposal link is invalid or has expired.",
};

const es: ProposalDocumentCopy = {
  languageToggle: "English",
  serviceProposal: "Propuesta de servicios",
  date: "Fecha",
  preparedBy: "Preparado por",
  validFor: "Válida por",
  days: "días",
  sections: {
    intro: "Introducción",
    includes: "Qué incluye",
    investment: "Inversión",
    warranty: "Garantía",
    terms: "Términos",
    accept: "Aceptar",
    custom: "Sección",
  },
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
    "Al aceptar, confirmas los servicios y el calendario de pagos indicados. Se generará un contrato para tu firma.",
  acceptProposal: "Aceptar propuesta",
  acceptPending: "Procesando…",
  signContract: "Firmar contrato",
  signatoryName: "Nombre legal completo",
  signatoryPlaceholder: "Tu nombre completo",
  agreeTerms: "He leído y acepto los términos y condiciones.",
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
  validUntil: "Válida hasta",
  loading: "Cargando propuesta…",
  invalidLink: "Enlace de propuesta no válido.",
  expiredLink: "Este enlace no es válido o ha expirado.",
};

export const getProposalDocumentCopy = (locale: ProposalLocale): ProposalDocumentCopy =>
  locale === "es" ? es : en;

export const proposalDateLocale = (locale: ProposalLocale) =>
  locale === "es" ? "es-US" : "en-US";
