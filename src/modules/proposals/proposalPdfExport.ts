import type { Proposal } from "@/modules/types";
import type { ProposalDocumentDataSnapshot } from "@/modules/proposals/document/mapPublicProposalDocumentData";
import type { ProposalDocumentContent } from "@/modules/proposals/document/proposalDocumentTypes";
import type { ProposalLocale } from "@/modules/proposals/document/proposalDocumentI18n";
import { hydrateProposalContent } from "@/modules/proposals/document/proposalTemplateContent";
import { resolveProposalDocumentContent } from "@/modules/proposals/document/proposalLocalizedContent";
import {
  buildProposalVariableContext,
  mergeProposalDocumentContent,
} from "@/modules/proposals/document/proposalVariableMerge";
import { applyProposalPrintStressTest } from "@/modules/proposals/pdf/applyProposalPrintStressTest";
import { buildProposalPrintModel } from "@/modules/proposals/pdf/buildProposalPrintModel";
import { buildProposalPdfDocument } from "@/modules/proposals/pdf/buildProposalPdfDocument";
import { getPdfMake } from "@/modules/proposals/pdf/initPdfMake";

/** @deprecated DOM capture root — print/PDF now uses flowing pdfmake layout. */
export const PROPOSAL_PDF_ROOT_ID = "proposal-pdf-root";

export type ExportProposalPdfOptions = {
  proposal: Pick<Proposal, "id" | "proposal_number" | "title">;
  content: ProposalDocumentContent;
  snapshot: ProposalDocumentDataSnapshot;
  locale?: ProposalLocale;
  /** QA only — expands line items, installments, and terms for pagination testing. */
  stressTest?: boolean;
};

const buildFilename = (
  proposal: Pick<Proposal, "proposal_number" | "id">,
  stressTest?: boolean,
) => {
  const base = proposal.proposal_number ?? `proposal-${proposal.id}`;
  return stressTest ? `${base}-STRESS.pdf` : `${base}.pdf`;
};

export const generateProposalPdfBlob = async (
  options: ExportProposalPdfOptions,
): Promise<Blob> => {
  const locale = options.locale ?? "en";
  const variables = buildProposalVariableContext({
    proposal: options.snapshot.proposal,
    company: options.snapshot.company,
    contact: options.snapshot.contact,
    deal: options.snapshot.deal,
    member: options.snapshot.member,
    organizationName: options.snapshot.organization?.name,
  });

  const hydrated = hydrateProposalContent(options.content);
  const merged = mergeProposalDocumentContent(hydrated, variables);
  const localized = resolveProposalDocumentContent(merged, locale);

  let model = buildProposalPrintModel({
    content: localized,
    snapshot: options.snapshot,
    locale,
    variables,
  });

  if (options.stressTest) {
    model = applyProposalPrintStressTest(model);
  }

  const docDefinition = buildProposalPdfDocument(model);
  const pdfMake = await getPdfMake();
  const pdf = pdfMake.createPdf(docDefinition);
  return pdf.getBlob();
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

/**
 * Flowing PDF export (pdfmake) — text and markdown only.
 * Sales deck + investment first; contract terms start on a new page with the proposal cover.
 * Images appear on the web proposal only, not in the downloaded PDF.
 */
export const exportProposalPdf = async (options: ExportProposalPdfOptions) => {
  const blob = await generateProposalPdfBlob(options);
  downloadBlob(blob, buildFilename(options.proposal, options.stressTest));
};

export const exportProposalStressTestPdf = async (
  options: Omit<ExportProposalPdfOptions, "stressTest">,
) => exportProposalPdf({ ...options, stressTest: true });
