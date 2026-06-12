import type { ProposalLocale } from "@/modules/proposals/document/proposalDocumentI18n";

export type ProposalAcceptPortalCopy = {
  pageTitle: string;
  stepSign: string;
  stepDeposit: string;
  oneTimePayment: string;
  recurring: string;
  totalProject: string;
  termsHeading: string;
  termsScrollHint: string;
  agreeTerms: string;
  signatureLabel: string;
  signaturePlaceholder: string;
  signAndContinue: string;
  signing: string;
  signedBanner: string;
  payDepositTitle: string;
  depositInitial: (percent: number) => string;
  balanceNote: (count: number, amount: string) => string;
  paymentDetails: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  stripeSecure: string;
  payDeposit: (amount: string) => string;
  paying: string;
  depositFootnote: string;
  signatureFootnote: string;
  backToProposal: string;
  completeTitle: string;
  completeBody: string;
  termsRequired: string;
  previewDisabled: string;
  mockModeNote: string;
};

const en: ProposalAcceptPortalCopy = {
  pageTitle: "Accept your proposal",
  stepSign: "Sign",
  stepDeposit: "Deposit",
  oneTimePayment: "One-time payment",
  recurring: "Recurring",
  totalProject: "Total project",
  termsHeading: "Terms and conditions",
  termsScrollHint: "Scroll to read the full terms",
  agreeTerms:
    "I have read and agree to the terms and conditions. I understand my signature creates a binding agreement.",
  signatureLabel: "Signature — type your full legal name",
  signaturePlaceholder: "Full legal name",
  signAndContinue: "Sign and continue to deposit",
  signing: "Signing…",
  signedBanner: "Contract signed — deposit pending",
  payDepositTitle: "Pay your deposit to get started",
  depositInitial: (percent) => `Initial deposit (${percent}%)`,
  balanceNote: (count, amount) =>
    `Balance: ${count} weekly payments of ${amount} — automatic debit`,
  paymentDetails: "Payment details",
  cardNumber: "Card number",
  cardExpiry: "MM / YY",
  cardCvc: "CVC",
  stripeSecure: "Secure payment processed by Stripe",
  payDeposit: (amount) => `Pay deposit ${amount}`,
  paying: "Processing payment…",
  depositFootnote:
    "Work begins once your deposit is confirmed. The balance is charged automatically per your plan.",
  signatureFootnote:
    "Your name, date, time, and IP are recorded as an electronic signature with the same validity as a handwritten signature.",
  backToProposal: "Back to proposal",
  completeTitle: "You're all set",
  completeBody:
    "Thank you. Your deposit was recorded and your project will be activated shortly.",
  termsRequired:
    "Contract terms are not available yet. Please contact your LBS representative.",
  previewDisabled: "Preview only — signing and payment work on your shared link.",
  mockModeNote:
    "Development mode: payment is simulated. Connect Stripe to charge cards in production.",
};

const es: ProposalAcceptPortalCopy = {
  pageTitle: "Accept your proposal",
  stepSign: "Sign",
  stepDeposit: "Deposit",
  oneTimePayment: "One-time payment",
  recurring: "Recurring",
  totalProject: "Total project",
  termsHeading: "Terms and conditions",
  termsScrollHint: "Scroll to read the full terms",
  agreeTerms:
    "I have read and agree to the terms and conditions. I understand my signature creates a binding agreement.",
  signatureLabel: "Signature — type your full legal name",
  signaturePlaceholder: "Full legal name",
  signAndContinue: "Sign and continue to deposit",
  signing: "Signing…",
  signedBanner: "Contract signed — deposit pending",
  payDepositTitle: "Pay your deposit to get started",
  depositInitial: (percent) => `Initial deposit (${percent}%)`,
  balanceNote: (count, amount) =>
    `Balance: ${count} weekly payments of ${amount} — automatic debit`,
  paymentDetails: "Payment details",
  cardNumber: "Card number",
  cardExpiry: "MM / YY",
  cardCvc: "CVC",
  stripeSecure: "Secure payment processed by Stripe",
  payDeposit: (amount) => `Pay deposit ${amount}`,
  paying: "Processing payment…",
  depositFootnote:
    "Work begins once your deposit is confirmed. The balance is charged automatically per your plan.",
  signatureFootnote:
    "Your name, date, time, and IP are recorded as an electronic signature with the same validity as a handwritten signature.",
  backToProposal: "Back to proposal",
  completeTitle: "You're all set",
  completeBody:
    "Thank you. Your deposit was recorded and your project will be activated shortly.",
  termsRequired:
    "Contract terms are not available yet. Please contact your LBS representative.",
  previewDisabled: "Preview only — signing and payment work on your shared link.",
  mockModeNote:
    "Development mode: payment is simulated. Connect Stripe to charge cards in production.",
};

export const getProposalAcceptPortalCopy = (
  locale: ProposalLocale,
): ProposalAcceptPortalCopy => (locale === "es" ? es : en);
