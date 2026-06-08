/** On-screen invoice document width (~US Letter/A4). */
export const INVOICE_DOCUMENT_MAX_WIDTH_CLASS = "max-w-[210mm]";

export const invoiceDocumentOuterClass = `mx-auto w-full ${INVOICE_DOCUMENT_MAX_WIDTH_CLASS} pb-8`;

export const invoiceDocumentArticleClass =
  "relative overflow-hidden rounded-lg border bg-white text-slate-900 shadow-md";

export const invoiceDocumentInnerClass = "p-4 sm:p-8 md:p-10";
