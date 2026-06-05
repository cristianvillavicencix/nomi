import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "@/lbs/proposals/pdf/initPdfMake";
import type { ClientInvoice, ClientInvoiceLineItem } from "@/lbs/types";

export type ClientInvoicePdfContext = {
  invoice: ClientInvoice;
  organizationName: string;
  organizationWebsite?: string | null;
  organizationAddress?: string | null;
  companyName?: string | null;
  contactName?: string | null;
  billToEmail?: string | null;
  billToPhone?: string | null;
  lineItems?: ClientInvoiceLineItem[];
};

export const buildClientInvoicePdfContext = ({
  invoice,
  organizationName,
  organizationAddress,
  organizationWebsite,
  company,
  contact,
  lineItems,
  billToEmail,
}: {
  invoice: ClientInvoice;
  organizationName: string;
  organizationAddress?: string | null;
  organizationWebsite?: string | null;
  company?: { name?: string | null } | null;
  contact?: {
    first_name?: string | null;
    last_name?: string | null;
    email_jsonb?: Array<{ email?: string; isPrimary?: boolean }>;
    phone_jsonb?: Array<{ number?: string; isPrimary?: boolean }>;
  } | null;
  lineItems?: ClientInvoiceLineItem[];
  billToEmail?: string;
}): ClientInvoicePdfContext => ({
  invoice,
  organizationName,
  organizationAddress,
  organizationWebsite,
  companyName: company?.name,
  contactName: contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
    : null,
  billToEmail,
  billToPhone:
    contact?.phone_jsonb?.find((row) => row.isPrimary)?.number ??
    contact?.phone_jsonb?.[0]?.number,
  lineItems,
});

const formatMoney = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const buildLineItemsTable = (
  lineItems: ClientInvoiceLineItem[],
  fallbackDescription: string,
  fallbackAmount: number,
  currency: string,
) => {
  if (lineItems.length === 0) {
    return {
      table: {
        headerRows: 1,
        widths: [24, "*", 52, 52, 64],
        body: [
          [
            { text: "#", style: "tableHeaderDark" },
            { text: "Item & Description", style: "tableHeaderDark" },
            { text: "Qty", style: "tableHeaderDark", alignment: "right" },
            { text: "Rate", style: "tableHeaderDark", alignment: "right" },
            { text: "Amount", style: "tableHeaderDark", alignment: "right" },
          ],
          [
            "1",
            fallbackDescription,
            { text: "1.00", alignment: "right" },
            {
              text: fallbackAmount.toFixed(2),
              alignment: "right",
            },
            {
              text: formatMoney(fallbackAmount, currency),
              alignment: "right",
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0,
        hLineColor: () => "#e2e8f0",
      },
    };
  }

  return {
    table: {
      headerRows: 1,
      widths: [24, "*", 52, 52, 64],
      body: [
        [
          { text: "#", style: "tableHeaderDark" },
          { text: "Item & Description", style: "tableHeaderDark" },
          { text: "Qty", style: "tableHeaderDark", alignment: "right" },
          { text: "Rate", style: "tableHeaderDark", alignment: "right" },
          { text: "Amount", style: "tableHeaderDark", alignment: "right" },
        ],
        ...lineItems.map((line, index) => {
          const parts = String(line.description ?? "").split("\n");
          const title = parts[0] ?? "";
          const detail = parts.slice(1).join("\n");
          return [
            String(index + 1),
            detail
              ? { stack: [{ text: title, bold: true }, { text: detail, fontSize: 9, color: "#64748b" }] }
              : title,
          {
            stack: [
              {
                text: Number(line.quantity).toFixed(2),
                alignment: "right",
              },
              {
                text: line.unit ?? "ea",
                fontSize: 8,
                color: "#64748b",
                alignment: "right",
              },
            ],
          },
          {
            text: Number(line.unit_price).toFixed(2),
            alignment: "right",
          },
          {
            text: formatMoney(Number(line.line_total) || 0, currency),
            alignment: "right",
          },
        ];
        }),
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => "#e2e8f0",
    },
  };
};

const buildDocDefinition = (
  ctx: ClientInvoicePdfContext,
): TDocumentDefinitions => {
  const {
    invoice,
    organizationName,
    organizationWebsite,
    organizationAddress,
    companyName,
    contactName,
    billToEmail,
    billToPhone,
    lineItems = [],
  } = ctx;
  const currency = invoice.currency ?? "USD";
  const billTo = companyName ?? contactName ?? "Client";
  const lineSubtotal = lineItems.reduce(
    (sum, line) => sum + Number(line.line_total || 0),
    0,
  );
  const subtotal =
    Number(invoice.subtotal ?? (lineSubtotal || invoice.amount)) || 0;
  const discountAmount = Number(invoice.discount_amount) || 0;
  const feeAmount = Number(invoice.fee_amount) || 0;
  const total = Number(invoice.amount) || subtotal - discountAmount + feeAmount;

  const totalsRows: unknown[][] = [
    [
      { text: "Sub Total", color: "#64748b" },
      { text: formatMoney(subtotal, currency), alignment: "right" },
    ],
  ];
  if (discountAmount > 0) {
    totalsRows.push([
      { text: "Discount", color: "#64748b" },
      {
        text: `-${formatMoney(discountAmount, currency)}`,
        alignment: "right",
      },
    ]);
  }
  if (feeAmount > 0) {
    totalsRows.push([
      { text: "Transfer Fee", color: "#64748b" },
      { text: formatMoney(feeAmount, currency), alignment: "right" },
    ]);
  }
  totalsRows.push(
    [
      { text: "Total", bold: true },
      {
        text: formatMoney(total, currency),
        alignment: "right",
        bold: true,
      },
    ],
    [
      { text: "Balance Due", bold: true },
      {
        text: formatMoney(total, currency),
        alignment: "right",
        bold: true,
      },
    ],
  );

  return {
    pageSize: "LETTER",
    pageMargins: [48, 48, 48, 48],
    content: [
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "INVOICE", style: "invoiceTitle" },
              {
                text: `Invoice# ${invoice.invoice_number ?? ""}`,
                style: "invoiceNumber",
              },
              { text: " ", margin: [0, 8] },
              { text: "Balance Due", style: "label" },
              { text: formatMoney(total, currency), style: "balanceDue" },
            ],
          },
          {
            width: "auto",
            stack: [
              { text: organizationName, style: "orgName", alignment: "right" },
              ...(organizationAddress
                ? [
                    {
                      text: organizationAddress,
                      style: "muted",
                      alignment: "right" as const,
                    },
                  ]
                : []),
              ...(organizationWebsite
                ? [
                    {
                      text: organizationWebsite,
                      style: "link",
                      alignment: "right" as const,
                    },
                  ]
                : []),
            ],
          },
        ],
      },
      { text: " ", margin: [0, 16] },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "Invoice Date", style: "label" },
              { text: formatDate(invoice.issue_date), style: "value" },
              { text: "Terms", style: "label", margin: [0, 8, 0, 0] },
              { text: invoice.terms ?? "Net 30", style: "value" },
              { text: "Due Date", style: "label", margin: [0, 8, 0, 0] },
              { text: formatDate(invoice.due_date), style: "value" },
              ...(invoice.reference?.trim()
                ? [
                    {
                      text: "PO / Ref",
                      style: "label",
                      margin: [0, 8, 0, 0],
                    },
                    { text: invoice.reference.trim(), style: "value" },
                  ]
                : []),
            ],
          },
          {
            width: "*",
            stack: [
              { text: "Bill To", style: "billToLabel" },
              { text: billTo, style: "billToName" },
              ...(contactName && companyName
                ? [{ text: contactName, style: "muted" }]
                : []),
              ...(billToEmail ? [{ text: billToEmail, style: "muted" }] : []),
              ...(billToPhone ? [{ text: billToPhone, style: "muted" }] : []),
            ],
          },
        ],
      },
      { text: " ", margin: [0, 20] },
      buildLineItemsTable(
        lineItems,
        invoice.description,
        total,
        currency,
      ),
      { text: " ", margin: [0, 12] },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 200,
            table: {
              widths: ["*", "auto"],
              body: totalsRows,
            },
            layout: "noBorders",
          },
        ],
      },
      ...(invoice.notes?.trim()
        ? [
            { text: " ", margin: [0, 24] },
            {
              text: "Terms & Conditions",
              style: "termsHeading",
            },
            {
              text: invoice.notes.trim(),
              style: "termsBody",
            },
          ]
        : []),
    ],
    styles: {
      orgName: { fontSize: 14, bold: true },
      invoiceTitle: { fontSize: 24, bold: true },
      invoiceNumber: { fontSize: 10, color: "#64748b", margin: [0, 4, 0, 0] },
      balanceDue: { fontSize: 22, bold: true, margin: [0, 2, 0, 0] },
      label: { fontSize: 9, color: "#64748b", margin: [0, 0, 0, 2] },
      value: { fontSize: 11 },
      billToLabel: { fontSize: 11, bold: true, margin: [0, 0, 0, 4] },
      billToName: { fontSize: 11, bold: true, color: "#1d4ed8" },
      muted: { fontSize: 10, color: "#64748b" },
      link: { fontSize: 10, color: "#2563eb" },
      tableHeaderDark: {
        bold: true,
        color: "#ffffff",
        fillColor: "#334155",
        margin: [4, 6, 4, 6],
        fontSize: 9,
      },
      termsHeading: {
        fontSize: 9,
        bold: true,
        color: "#64748b",
        margin: [0, 0, 0, 6],
        characterSpacing: 0.5,
      },
      termsBody: { fontSize: 9, color: "#475569", lineHeight: 1.35 },
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

export const printClientInvoicePdf = async (ctx: ClientInvoicePdfContext) => {
  await downloadClientInvoicePdf(ctx);
};
