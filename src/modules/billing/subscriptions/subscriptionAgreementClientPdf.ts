import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { getPdfMake } from "@/modules/proposals/pdf/initPdfMake";

export const buildSubscriptionAgreementPdfFilename = (
  subscriptionNumber?: string | null,
) => {
  const slug = (subscriptionNumber?.trim() || "agreement")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 48);
  return `subscription-agreement-${slug}.pdf`;
};

export const buildSubscriptionReceiptPdfFilename = (
  subscriptionNumber?: string | null,
) => {
  const slug = (subscriptionNumber?.trim() || "receipt")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 48);
  return `subscription-receipt-${slug}.pdf`;
};

/** Drop HTML/markdown so pdfmake gets readable plain text. */
export const stripAgreementMarkdownToPlain = (markdown: string) => {
  let text = markdown.replace(/\r\n/g, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/^>\s+/gm, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "• ");
  text = text.replace(/\|/g, " ");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export type SubscriptionAgreementPdfParams = {
  title: string;
  markdown: string;
  subscriptionNumber?: string | null;
  clientName?: string | null;
  signatoryName?: string | null;
  signedAt?: string | null;
  signaturePngDataUrl?: string | null;
};

const buildAgreementDocDefinition = (
  params: SubscriptionAgreementPdfParams,
): TDocumentDefinitions => {
  const plain = stripAgreementMarkdownToPlain(params.markdown || "");
  const meta: Content[] = [];
  if (params.subscriptionNumber?.trim()) {
    meta.push({
      text: `Contract: ${params.subscriptionNumber.trim()}`,
      fontSize: 10,
      color: "#334155",
      margin: [0, 0, 0, 2],
    });
  }
  if (params.clientName?.trim()) {
    meta.push({
      text: `Client: ${params.clientName.trim()}`,
      fontSize: 10,
      color: "#334155",
      margin: [0, 0, 0, 2],
    });
  }
  if (params.signatoryName?.trim()) {
    meta.push({
      text: `Signed by: ${params.signatoryName.trim()}`,
      fontSize: 10,
      color: "#334155",
      margin: [0, 0, 0, 2],
    });
  }
  if (params.signedAt?.trim()) {
    const when = new Date(params.signedAt).toLocaleString("en-US");
    meta.push({
      text: `Signed at: ${when}`,
      fontSize: 10,
      color: "#334155",
      margin: [0, 0, 0, 8],
    });
  }

  const content: Content[] = [
    {
      text: params.title.trim() || "Subscription agreement",
      fontSize: 16,
      bold: true,
      margin: [0, 0, 0, 8],
    },
    ...meta,
    {
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 515,
          y2: 0,
          lineWidth: 1,
          lineColor: "#cbd5e1",
        },
      ],
      margin: [0, 0, 0, 12],
    },
    {
      text: plain || "No agreement terms saved.",
      fontSize: 10,
      lineHeight: 1.35,
      color: "#1e293b",
    },
  ];

  const sig = params.signaturePngDataUrl?.trim() || "";
  if (sig.startsWith("data:image/")) {
    content.push({
      text: "Client signature",
      fontSize: 10,
      bold: true,
      margin: [0, 16, 0, 6],
    });
    content.push({
      image: sig,
      width: 180,
      margin: [0, 0, 0, 4],
    });
  }

  return {
    pageSize: "A4",
    pageMargins: [48, 48, 48, 48],
    content,
    defaultStyle: {
      font: "Roboto",
    },
  };
};

export const downloadSubscriptionAgreementPdf = async (
  params: SubscriptionAgreementPdfParams,
) => {
  const pdfMake = await getPdfMake();
  const blob = await pdfMake
    .createPdf(buildAgreementDocDefinition(params))
    .getBlob();
  triggerBlobDownload(
    blob,
    buildSubscriptionAgreementPdfFilename(params.subscriptionNumber),
  );
};

export type SubscriptionReceiptPdfParams = {
  organizationName?: string | null;
  subscriptionName: string;
  subscriptionNumber?: string | null;
  clientName: string;
  amount: number;
  currency?: string | null;
  billingInterval?: string | null;
  paymentMethodLast4?: string | null;
  paymentMethodBrand?: string | null;
  completedAt?: string | null;
};

export const downloadSubscriptionSetupReceiptPdf = async (
  params: SubscriptionReceiptPdfParams,
) => {
  const currency = (params.currency || "USD").toUpperCase();
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(params.amount) || 0);
  const when = params.completedAt?.trim()
    ? new Date(params.completedAt).toLocaleString("en-US")
    : new Date().toLocaleString("en-US");
  const card = params.paymentMethodLast4?.trim()
    ? `${params.paymentMethodBrand?.trim() || "Card"} ····${params.paymentMethodLast4.trim()}`
    : "Card on file";

  const rows: Array<[string, string]> = [
    ["Plan", params.subscriptionName],
  ];
  if (params.subscriptionNumber?.trim()) {
    rows.push(["Contract #", params.subscriptionNumber.trim()]);
  }
  rows.push(
    ["Client", params.clientName],
    ["Amount", `${money} / ${params.billingInterval || "monthly"}`],
    ["Payment method", card],
    ["Completed", when],
  );

  const doc: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageMargins: [48, 48, 48, 48],
    content: [
      {
        text: "SUBSCRIPTION RECEIPT",
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 6],
      },
      {
        text: params.organizationName?.trim() || "Latino Business Support",
        fontSize: 12,
        bold: true,
        margin: [0, 0, 0, 18],
      },
      {
        table: {
          widths: [140, "*"],
          body: rows.map(([label, value]) => [
            { text: label, color: "#64748b", fontSize: 10 },
            { text: value, fontSize: 11, bold: label === "Plan" },
          ]),
        },
        layout: "noBorders",
      },
      {
        text: "Your card is on file for recurring billing.",
        fontSize: 10,
        color: "#64748b",
        margin: [0, 20, 0, 0],
      },
    ],
    defaultStyle: { font: "Roboto" },
  };

  const pdfMake = await getPdfMake();
  const blob = await pdfMake.createPdf(doc).getBlob();
  triggerBlobDownload(
    blob,
    buildSubscriptionReceiptPdfFilename(params.subscriptionNumber),
  );
};
