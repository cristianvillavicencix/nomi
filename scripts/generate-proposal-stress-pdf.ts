/**
 * Generates a stress-test proposal PDF (many lines, installments, long terms).
 * Run: npm run proposal-pdf:stress
 * Output: ./proposal-STRESS-sample.pdf
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PROPOSAL_TEMPLATES } from "../src/lbs/proposals/document/proposalTemplateDefaults";
import { parseProposalContent } from "../src/lbs/proposals/document/proposalDocumentTypes";
import { hydrateProposalContent } from "../src/lbs/proposals/document/proposalTemplateContent";
import { buildProposalPrintModel } from "../src/lbs/proposals/pdf/buildProposalPrintModel";
import { applyProposalPrintStressTest } from "../src/lbs/proposals/pdf/applyProposalPrintStressTest";
import { buildProposalPdfDocument } from "../src/lbs/proposals/pdf/buildProposalPdfDocument";
import { pdfMake } from "../src/lbs/proposals/pdf/initPdfMake";
import type { Proposal } from "../src/lbs/types";
import type { ProposalDocumentDataSnapshot } from "../src/lbs/proposals/document/mapPublicProposalDocumentData";
import type { ProposalLineDraft } from "../src/lbs/proposals/proposalCommercialUtils";
import type { ProposalPaymentInstallment } from "../src/lbs/types";

const root = join(import.meta.dirname, "..");
const seed = DEFAULT_PROPOSAL_TEMPLATES[0]!;
const content = hydrateProposalContent(seed.content);

const proposal = {
  id: 1,
  title: content.hero_title ?? "Stress test proposal",
  proposal_number: "PROP-STRESS-0001",
  currency: "USD",
  validity_days: 30,
  valid_until: "2026-12-31",
  deposit_amount: 2500,
  amount: 12500,
  one_time_total: 12500,
} as Proposal;

const lineDrafts: ProposalLineDraft[] = [
  {
    key: "pkg",
    description: "Professional website package",
    quantity: 1,
    unit_price: 8500,
    billing_type: "one_time",
    package_id: 1,
    sort_order: 0,
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    key: `addon-${i}`,
    description: `Add-on ${i + 1}`,
    quantity: 1,
    unit_price: 150 + i * 75,
    billing_type: (i % 2 === 0 ? "one_time" : "recurring") as
      | "one_time"
      | "recurring",
    billing_interval: i % 2 === 0 ? null : ("monthly" as const),
    sort_order: i + 1,
  })),
];

const paymentInstallments: ProposalPaymentInstallment[] = [
  {
    id: 1,
    proposal_id: 1,
    schedule_id: 0,
    installment_number: 1,
    label: "Deposit (50%)",
    due_date: "2026-06-15",
    amount: 6250,
    billing_type: "one_time",
    status: "pending",
  },
  ...Array.from({ length: 5 }, (_, i) => ({
    id: i + 2,
    proposal_id: 1,
    schedule_id: 0,
    installment_number: i + 2,
    label: `Balance payment ${i + 1}`,
    due_date: `2026-07-${String(1 + i * 5).padStart(2, "0")}`,
    amount: 1250,
    billing_type: "one_time" as const,
    status: "pending" as const,
  })),
];

const snapshot: ProposalDocumentDataSnapshot = {
  proposal,
  lineDrafts,
  paymentInstallments,
  oneTimeTotal: 12500,
  recurringSubtotal: 450,
  currency: "USD",
  company: {
    id: 1,
    name: "Acme Roofing & Very Long Company Name LLC",
  } as never,
  contact: { id: 1, first_name: "John", last_name: "Smith" } as never,
  termsMarkdown: null,
  termsTitle: null,
};

const variables = {
  empresa: "Acme Roofing & Very Long Company Name LLC",
  cliente: "John Smith",
  preparada_por: "Cristian Villavicencio",
  fecha: "Jun 2, 2026",
};

let model = buildProposalPrintModel({
  content: parseProposalContent(content),
  snapshot,
  locale: "en",
  variables,
});

model = applyProposalPrintStressTest(model);
const doc = buildProposalPdfDocument(model);
const outPath = join(root, "proposal-STRESS-sample.pdf");

const output = pdfMake.createPdf(doc);
const buffer = await output.getBuffer();
writeFileSync(outPath, buffer);
console.warn(`Wrote ${outPath} (${buffer.length} bytes)`);
