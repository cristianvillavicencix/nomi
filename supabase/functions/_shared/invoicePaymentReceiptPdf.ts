import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {
  INVOICE_ORGANIZATION_ADDRESS_LINE,
  INVOICE_ORGANIZATION_EMAIL,
  INVOICE_ORGANIZATION_NAME,
  INVOICE_ORGANIZATION_PHONE,
} from "./invoiceOrganizationInfo.ts";

export type PaymentReceiptPdfParams = {
  organizationName?: string;
  invoiceNumber: string;
  billToName: string;
  billToEmail?: string | null;
  chargedAmount: number;
  totalPaid: number;
  invoiceTotal: number;
  balanceDue: number;
  currency?: string;
  paidInFull: boolean;
  paymentMethodLabel?: string | null;
  paymentReference: string;
  paymentDate: string;
};

const formatMoney = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(Number(amount) || 0);

const formatDisplayDate = (dateKey: string) => {
  const parsed = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const drawLabelValue = (
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontBold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  x: number,
  y: number,
  label: string,
  value: string,
  valueBold = false,
) => {
  page.drawText(label, {
    x,
    y,
    size: 9,
    font,
    color: rgb(0.39, 0.45, 0.55),
  });
  page.drawText(value, {
    x: x + 140,
    y,
    size: 11,
    font: valueBold ? fontBold : font,
    color: rgb(0.06, 0.09, 0.16),
  });
};

export async function generatePaymentReceiptPdfBase64(
  params: PaymentReceiptPdfParams,
): Promise<string> {
  const orgName = params.organizationName?.trim() || INVOICE_ORGANIZATION_NAME;
  const currency = params.currency ?? "USD";
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 740;

  page.drawText("PAYMENT RECEIPT", {
    x: 48,
    y,
    size: 22,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  });

  page.drawText(orgName, {
    x: 360,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  });

  y -= 18;
  page.drawText(INVOICE_ORGANIZATION_ADDRESS_LINE, {
    x: 360,
    y,
    size: 9,
    font,
    color: rgb(0.39, 0.45, 0.55),
  });

  y -= 14;
  page.drawText(
    `${INVOICE_ORGANIZATION_PHONE} · ${INVOICE_ORGANIZATION_EMAIL}`,
    {
      x: 360,
      y,
      size: 9,
      font,
      color: rgb(0.39, 0.45, 0.55),
    },
  );

  y -= 36;
  page.drawText(`Receipt for ${params.invoiceNumber}`, {
    x: 48,
    y,
    size: 11,
    font,
    color: rgb(0.39, 0.45, 0.55),
  });

  y -= 28;
  drawLabelValue(
    page,
    font,
    fontBold,
    48,
    y,
    "Payment date",
    formatDisplayDate(params.paymentDate),
  );
  y -= 22;
  drawLabelValue(
    page,
    font,
    fontBold,
    48,
    y,
    "Reference",
    params.paymentReference,
  );
  y -= 22;
  drawLabelValue(page, font, fontBold, 48, y, "Bill to", params.billToName);
  if (params.billToEmail?.trim()) {
    y -= 22;
    drawLabelValue(
      page,
      font,
      fontBold,
      48,
      y,
      "Email",
      params.billToEmail.trim(),
    );
  }

  y -= 36;
  page.drawRectangle({
    x: 48,
    y: y - 120,
    width: 516,
    height: 120,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.89, 0.91, 0.94),
    borderWidth: 1,
  });

  const boxY = y - 24;
  drawLabelValue(
    page,
    font,
    fontBold,
    64,
    boxY,
    "Amount paid",
    `${formatMoney(params.chargedAmount, currency)}${
      params.paymentMethodLabel ? ` (${params.paymentMethodLabel})` : ""
    }`,
    true,
  );
  drawLabelValue(
    page,
    font,
    fontBold,
    64,
    boxY - 24,
    "Total paid to date",
    formatMoney(params.totalPaid, currency),
  );
  drawLabelValue(
    page,
    font,
    fontBold,
    64,
    boxY - 48,
    "Invoice total",
    formatMoney(params.invoiceTotal, currency),
  );
  drawLabelValue(
    page,
    font,
    fontBold,
    64,
    boxY - 72,
    params.paidInFull ? "Status" : "Balance due",
    params.paidInFull
      ? "Paid in full"
      : formatMoney(params.balanceDue, currency),
    true,
  );

  y -= 150;
  page.drawText(
    params.paidInFull
      ? "Thank you for your payment. This invoice is paid in full."
      : "Thank you for your payment. Your remaining balance is shown above.",
    {
      x: 48,
      y,
      size: 10,
      font,
      color: rgb(0.28, 0.33, 0.41),
      maxWidth: 516,
      lineHeight: 14,
    },
  );

  y -= 40;
  page.drawText(orgName, {
    x: 48,
    y,
    size: 9,
    font,
    color: rgb(0.39, 0.45, 0.55),
  });

  const bytes = await pdfDoc.save();
  return bytesToBase64(bytes);
}

export const buildPaymentReceiptFilename = (
  invoiceNumber: string,
  paymentReference: string,
) => {
  const safeNumber = invoiceNumber.replace(/[^\w.-]+/g, "-");
  const suffix = paymentReference.replace(/^pi_/, "").slice(-8) || "payment";
  return `${safeNumber}-receipt-${suffix}.pdf`;
};
