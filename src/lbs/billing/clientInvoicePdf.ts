import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "@/lbs/proposals/pdf/initPdfMake";
import type { ClientInvoice } from "@/lbs/types";

export type ClientInvoicePdfContext = {
  invoice: ClientInvoice;
  organizationName: string;
  companyName?: string | null;
  contactName?: string | null;
  billToEmail?: string | null;
};

const formatMoney = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const buildDocDefinition = (
  ctx: ClientInvoicePdfContext,
): TDocumentDefinitions => {
  const { invoice, organizationName, companyName, contactName, billToEmail } =
    ctx;
  const billTo = companyName ?? contactName ?? "Client";

  return {
    pageSize: "LETTER",
    pageMargins: [48, 48, 48, 48],
    content: [
      {
        columns: [
          { text: organizationName, style: "orgName" },
          {
            stack: [
              { text: "INVOICE", style: "invoiceTitle", alignment: "right" },
              {
                text: invoice.invoice_number ?? "",
                style: "invoiceNumber",
                alignment: "right",
              },
            ],
          },
        ],
      },
      { text: " ", margin: [0, 12] },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "Bill to", style: "label" },
              { text: billTo, style: "value" },
              ...(contactName && companyName
                ? [{ text: contactName, style: "muted" }]
                : []),
              ...(billToEmail ? [{ text: billToEmail, style: "muted" }] : []),
            ],
          },
          {
            width: "auto",
            stack: [
              { text: "Issue date", style: "label", alignment: "right" },
              {
                text: formatDate(invoice.issue_date),
                style: "value",
                alignment: "right",
              },
              { text: "Due date", style: "label", alignment: "right", margin: [0, 8, 0, 0] },
              {
                text: formatDate(invoice.due_date),
                style: "value",
                alignment: "right",
              },
              {
                text: "Status",
                style: "label",
                alignment: "right",
                margin: [0, 8, 0, 0],
              },
              {
                text: (invoice.status ?? "draft").replace(/_/g, " "),
                style: "value",
                alignment: "right",
                capitalize: true,
              },
            ],
          },
        ],
      },
      { text: " ", margin: [0, 20] },
      {
        table: {
          headerRows: 1,
          widths: ["*", 80],
          body: [
            [
              { text: "Description", style: "tableHeader" },
              { text: "Amount", style: "tableHeader", alignment: "right" },
            ],
            [
              invoice.description,
              {
                text: formatMoney(
                  Number(invoice.amount) || 0,
                  invoice.currency ?? "USD",
                ),
                alignment: "right",
              },
            ],
          ],
        },
        layout: "lightHorizontalLines",
      },
      { text: " ", margin: [0, 16] },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 200,
            table: {
              widths: ["*", "auto"],
              body: [
                [
                  { text: "Total due", style: "totalLabel" },
                  {
                    text: formatMoney(
                      Number(invoice.amount) || 0,
                      invoice.currency ?? "USD",
                    ),
                    style: "totalValue",
                    alignment: "right",
                  },
                ],
              ],
            },
            layout: "noBorders",
          },
        ],
      },
      {
        text: "Thank you for your business.",
        style: "muted",
        margin: [0, 32, 0, 0],
      },
    ],
    styles: {
      orgName: { fontSize: 16, bold: true },
      invoiceTitle: { fontSize: 22, bold: true, color: "#334155" },
      invoiceNumber: { fontSize: 11, color: "#64748b", margin: [0, 4, 0, 0] },
      label: { fontSize: 9, color: "#64748b", margin: [0, 0, 0, 2] },
      value: { fontSize: 11, bold: true },
      muted: { fontSize: 10, color: "#64748b" },
      tableHeader: { bold: true, fillColor: "#f1f5f9", margin: [4, 6, 4, 6] },
      totalLabel: { bold: true, fontSize: 12 },
      totalValue: { bold: true, fontSize: 14 },
    },
    defaultStyle: { fontSize: 10, lineHeight: 1.25 },
  };
};

export const generateClientInvoicePdfBlob = async (
  ctx: ClientInvoicePdfContext,
): Promise<Blob> => {
  const doc = buildDocDefinition(ctx);
  const pdf = pdfMake.createPdf(doc);
  return pdf.getBlob();
};

export const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const downloadClientInvoicePdf = async (
  ctx: ClientInvoicePdfContext,
) => {
  const blob = await generateClientInvoicePdfBlob(ctx);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${ctx.invoice.invoice_number ?? "invoice"}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
};
