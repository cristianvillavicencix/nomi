import type { ProposalLocale } from "@/modules/proposals/document/proposalDocumentI18n";

export type ProposalPaymentFlowCopy = {
  consentLabel: string;
  payNow: (amount: string) => string;
  processing: string;
  scheduleTitle: string;
  scheduleIntro: (count: number) => string;
  depositSuccessTitle: string;
  depositSuccessBody: string;
  paidInFullTitle: string;
  paidInFullBody: string;
  cardError: string;
  stripeNotConfigured: string;
  authenticateTitle: string;
  authenticateHint: string;
};

const en: ProposalPaymentFlowCopy = {
  consentLabel:
    "I authorize LBS to charge my card for the deposit today and to automatically charge the remaining installments on the dates listed below. I understand these charges will use the same card without requiring me to re-enter payment details.",
  payNow: (amount) => `Pay ${amount} now`,
  processing: "Processing payment…",
  scheduleTitle: "Automatic payment schedule",
  scheduleIntro: (count) =>
    `After your deposit, ${count} remaining installment${count === 1 ? "" : "s"} will be charged automatically on:`,
  depositSuccessTitle: "Deposit received",
  depositSuccessBody:
    "Your deposit was successful. Remaining installments will be charged automatically on the dates below.",
  paidInFullTitle: "Payment complete",
  paidInFullBody:
    "All installments are paid. Your project will be activated shortly.",
  cardError: "Could not process your card. Please try again.",
  stripeNotConfigured: "Card payments are not available yet. Contact your LBS representative.",
  authenticateTitle: "Additional verification required",
  authenticateHint: "Complete the verification step from your bank, then try again.",
};

export const getProposalPaymentFlowCopy = (
  locale: ProposalLocale,
): ProposalPaymentFlowCopy => en;
