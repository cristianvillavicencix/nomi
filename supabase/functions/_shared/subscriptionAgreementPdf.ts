import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/** Helvetica/WinAnsi cannot draw many Spanish glyphs — strip accents. */
export const sanitizePdfText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");

const stripMarkdownToPlain = (markdown: string) => {
  let text = markdown.replace(/\r\n/g, "\n");
  // Drop HTML blocks (signature grid etc.) but keep readable leftovers.
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/^>\s+/gm, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "• ");
  text = text.replace(/\|/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
};

const wrapLines = (
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  maxWidth: number,
) => {
  const paragraphs = text.split(/\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trimEnd();
    if (!trimmed) {
      lines.push("");
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(sanitizePdfText(next), size);
      if (width <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
};

export async function generateSubscriptionAgreementPdfBase64(params: {
  title: string;
  markdown: string;
  subscriptionNumber?: string | null;
  clientName?: string | null;
  signaturePngDataUrl?: string | null;
}): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const margin = 48;
  const maxWidth = pageSize[0] - margin * 2;
  const lineHeight = 13;

  let page = pdfDoc.addPage(pageSize);
  let y = pageSize[1] - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage(pageSize);
      y = pageSize[1] - margin;
    }
  };

  const drawTextLine = (
    value: string,
    size: number,
    bold = false,
  ) => {
    ensureSpace(lineHeight + 2);
    page.drawText(sanitizePdfText(value), {
      x: margin,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.12, 0.14, 0.18),
    });
    y -= lineHeight;
  };

  drawTextLine(params.title.trim() || "Subscription agreement", 14, true);
  y -= 4;
  if (params.subscriptionNumber?.trim()) {
    drawTextLine(`Contract: ${params.subscriptionNumber.trim()}`, 10);
  }
  if (params.clientName?.trim()) {
    drawTextLine(`Client: ${params.clientName.trim()}`, 10);
  }
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageSize[0] - margin, y },
    thickness: 1,
    color: rgb(0.75, 0.78, 0.82),
  });
  y -= 16;

  const plain = stripMarkdownToPlain(params.markdown || "");
  for (const line of wrapLines(plain, font, 10, maxWidth)) {
    if (!line) {
      y -= lineHeight * 0.6;
      continue;
    }
    drawTextLine(line, 10);
  }

  const sig = params.signaturePngDataUrl?.trim() || "";
  if (sig.startsWith("data:image/")) {
    try {
      const base64 = sig.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const image = sig.includes("image/jpeg") || sig.includes("image/jpg")
        ? await pdfDoc.embedJpg(bytes)
        : await pdfDoc.embedPng(bytes);
      ensureSpace(90);
      y -= 12;
      drawTextLine("Client signature", 10, true);
      const dims = image.scale(0.35);
      ensureSpace(dims.height + 8);
      page.drawImage(image, {
        x: margin,
        y: y - dims.height,
        width: Math.min(dims.width, maxWidth * 0.5),
        height: dims.height,
      });
      y -= dims.height + 8;
    } catch {
      // Signature embed is best-effort.
    }
  }

  const bytes = await pdfDoc.save();
  return bytesToBase64(bytes);
}

export async function generateSubscriptionSetupReceiptPdfBase64(params: {
  organizationName?: string | null;
  subscriptionName: string;
  subscriptionNumber?: string | null;
  clientName: string;
  clientEmail?: string | null;
  amount: number;
  currency?: string;
  billingInterval: string;
  paymentMethodLast4?: string | null;
  paymentMethodBrand?: string | null;
  completedAt?: string | null;
}): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const org = params.organizationName?.trim() || "Latino Business Support";
  const currency = (params.currency || "USD").toUpperCase();
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(params.amount) || 0);
  const when = params.completedAt?.trim()
    ? new Date(params.completedAt).toLocaleString("en-US")
    : new Date().toLocaleString("en-US");
  const card =
    params.paymentMethodLast4?.trim()
      ? `${params.paymentMethodBrand?.trim() || "Card"} ····${params.paymentMethodLast4.trim()}`
      : "Card on file";

  let y = 740;
  const draw = (label: string, value: string, boldValue = false) => {
    page.drawText(sanitizePdfText(label), {
      x: 48,
      y,
      size: 10,
      font,
      color: rgb(0.39, 0.45, 0.55),
    });
    page.drawText(sanitizePdfText(value), {
      x: 220,
      y,
      size: 11,
      font: boldValue ? fontBold : font,
      color: rgb(0.06, 0.09, 0.16),
    });
    y -= 22;
  };

  page.drawText("SUBSCRIPTION RECEIPT", {
    x: 48,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  });
  y -= 28;
  page.drawText(sanitizePdfText(org), {
    x: 48,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  });
  y -= 36;

  draw("Plan", params.subscriptionName, true);
  if (params.subscriptionNumber?.trim()) {
    draw("Contract #", params.subscriptionNumber.trim());
  }
  draw("Client", params.clientName);
  if (params.clientEmail?.trim()) draw("Email", params.clientEmail.trim());
  draw("Amount", `${money} / ${params.billingInterval}`);
  draw("Payment method", card);
  draw("Completed", when);
  y -= 12;
  const note =
    "Your card is on file for recurring billing. A copy of the signed agreement is attached to your email.";
  for (const line of note.match(/.{1,80}(\s|$)/g) ?? [note]) {
    page.drawText(sanitizePdfText(line.trim()), {
      x: 48,
      y,
      size: 10,
      font,
      color: rgb(0.39, 0.45, 0.55),
    });
    y -= 14;
  }

  const bytes = await pdfDoc.save();
  return bytesToBase64(bytes);
}

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
