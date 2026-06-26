import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { markdownToPdfMakeContent } from "@/modules/proposals/pdf/markdownToPdfMake";
import { proposalPrintBlocksToPdfMake } from "@/modules/proposals/pdf/bodyBlocksToPdfMake";
import type { ProposalPrintModel } from "@/modules/proposals/pdf/proposalPrintTypes";

const markdownBody = (markdown: string): Content[] => {
  const trimmed = markdown.trim();
  if (!trimmed) return [];
  return markdownToPdfMakeContent(trimmed);
};

/** ~18mm side margins on Letter (72pt per inch). */
const PAGE_MARGIN_H = 51;
const PAGE_MARGIN_V = 51;

const sectionHeader = (kicker: string, title: string): Content[] => [
  {
    unbreakable: true,
    stack: [
      { text: kicker.toUpperCase(), style: "kicker" },
      { text: title, style: "h2" },
    ],
  },
];

const heroBlock = (model: ProposalPrintModel): Content => ({
  table: {
    widths: ["*"],
    body: [
      [
        {
          stack: [
            { text: model.hero.tag, style: "heroTag" },
            { text: model.hero.title, style: "heroTitle" },
            { text: model.hero.subtitle, style: "heroSubtitle" },
            {
              columns: model.hero.meta.map((item) => ({
                width: "33%",
                stack: [
                  { text: item.label.toUpperCase(), style: "heroMetaLabel" },
                  { text: item.value, style: "heroMetaValue" },
                ],
              })),
              columnGap: 12,
              margin: [0, 16, 0, 0] as [number, number, number, number],
            },
          ],
          fillColor: "#0d3b6e",
          margin: [20, 22, 20, 22] as [number, number, number, number],
        },
      ],
    ],
  },
  layout: "noBorders",
  margin: [0, 0, 0, 22] as [number, number, number, number],
});

const introBlock = (model: ProposalPrintModel): Content[] => {
  const stack: Content[] = [
    {
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
          lineWidth: 3,
          lineColor: "#1e5fa8",
        },
      ],
      margin: [0, 0, 0, 0] as [number, number, number, number],
    },
  ];

  if (model.intro.title.trim()) {
    stack.push({
      text: model.intro.title,
      style: "h2",
      margin: [14, 0, 0, 10],
    });
  }

  for (const block of markdownBody(model.intro.bodyMarkdown)) {
    stack.push({
      ...block,
      margin: [14, 0, 0, 10] as [number, number, number, number],
    });
  }

  if (model.intro.signatory?.trim()) {
    stack.push({
      unbreakable: true,
      stack: [
        {
          canvas: [
            {
              type: "line",
              x1: 14,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 0.5,
              lineColor: "#e2e8f0",
            },
          ],
          margin: [0, 16, 0, 10] as [number, number, number, number],
        },
        {
          stack: [
            {
              text: model.intro.signatory,
              bold: true,
              fontSize: 11,
            },
            {
              text: model.intro.signatoryOrg ?? "Latinos Business Support",
              fontSize: 9,
              color: "#64748b",
              margin: [0, 1, 0, 0] as [number, number, number, number],
            },
          ],
          margin: [14, 0, 0, 0] as [number, number, number, number],
        },
      ],
    });
  }

  return [{ stack, margin: [0, 0, 0, 20] as [number, number, number, number] }];
};

const lineItemRow = (
  description: string,
  sublabel: string | undefined,
  amount: string,
): Content[] => {
  const left: Content = sublabel
    ? {
        stack: [
          { text: description, bold: true, fontSize: 10 },
          { text: sublabel, fontSize: 9, color: "#64748b", italics: true },
        ],
      }
    : { text: description, fontSize: 10 };

  return [left, { text: amount, alignment: "right", bold: true, fontSize: 10 }];
};

const investmentBlock = (
  model: ProposalPrintModel,
  options?: { includeWarranty?: boolean },
): Content[] => {
  const inv = model.investment;
  const includeWarranty = options?.includeWarranty ?? true;
  const content: Content[] = [...sectionHeader(inv.kicker, inv.title)];

  if (inv.notes) {
    content.push({
      text: inv.notes,
      style: "bodyMuted",
      margin: [0, 0, 0, 12],
    });
  }

  const tableBody: Content[][] = [];

  if (inv.packageLine) {
    tableBody.push(
      lineItemRow(
        inv.packageLine.description,
        "Base package",
        inv.packageLine.amount,
      ),
    );
  }

  for (const line of inv.lineItems) {
    tableBody.push(
      lineItemRow(
        line.description,
        line.sublabel,
        line.isRecurring ? `${line.amount}/mo` : line.amount,
      ),
    );
  }

  if (tableBody.length > 0) {
    content.push({
      table: {
        widths: ["*", "auto"],
        dontBreakRows: true,
        body: tableBody,
      },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
          i === 0 || i === node.table.body.length ? 0 : 0.5,
        vLineWidth: () => 0,
        hLineColor: () => "#e2e8f0",
        paddingLeft: () => 12,
        paddingRight: () => 12,
        paddingTop: () => 8,
        paddingBottom: () => 8,
      },
      margin: [0, 0, 0, 0] as [number, number, number, number],
    });
  }

  content.push({
    unbreakable: true,
    table: {
      widths: ["*", "auto"],
      body: [
        [
          { text: inv.oneTimeLabel, fontSize: 10 },
          {
            text: inv.oneTimeAmount,
            alignment: "right",
            bold: true,
            fontSize: 10,
          },
        ],
        ...(inv.recurringLabel && inv.recurringAmount
          ? [
              [
                { text: inv.recurringLabel, fontSize: 10, color: "#1e5fa8" },
                {
                  text: inv.recurringAmount,
                  alignment: "right",
                  bold: true,
                  fontSize: 10,
                  color: "#1e5fa8",
                },
              ],
            ]
          : []),
      ],
    },
    layout: "noBorders",
    margin: [12, 8, 12, 0] as [number, number, number, number],
  });

  content.push({
    unbreakable: true,
    table: {
      widths: ["*", "auto"],
      body: [
        [
          {
            text: inv.grandLabel,
            bold: true,
            fontSize: 12,
            color: "#ffffff",
            fillColor: "#0d3b6e",
            margin: [14, 12, 8, 12] as [number, number, number, number],
          },
          {
            text: inv.grandAmount,
            alignment: "right",
            bold: true,
            fontSize: 14,
            color: "#ffffff",
            fillColor: "#0d3b6e",
            margin: [8, 12, 14, 12] as [number, number, number, number],
          },
        ],
      ],
    },
    layout: "noBorders",
    margin: [0, 0, 0, 16] as [number, number, number, number],
  });

  content.push({ text: inv.paymentsTitle, style: "h3", margin: [0, 0, 0, 8] });

  for (const row of inv.installments) {
    content.push({
      unbreakable: true,
      table: {
        widths: [36, "*", "auto"],
        body: [
          [
            {
              text: row.badge,
              alignment: "center",
              bold: true,
              fontSize: 9,
              fillColor: "#f1f5f9",
              margin: [4, 6, 4, 6] as [number, number, number, number],
            },
            {
              stack: [
                { text: row.label, bold: true, fontSize: 10 },
                { text: row.sublabel, fontSize: 9, color: "#64748b" },
              ],
              margin: [8, 6, 8, 6] as [number, number, number, number],
            },
            {
              text: row.amount,
              alignment: "right",
              bold: true,
              fontSize: 10,
              margin: [0, 6, 8, 6] as [number, number, number, number],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => "#e2e8f0",
        vLineColor: () => "#e2e8f0",
      },
      margin: [0, 0, 0, 8] as [number, number, number, number],
    });
  }

  if (inv.paymentNotes) {
    content.push({
      text: inv.paymentNotes,
      style: "bodyMuted",
      margin: [0, 4, 0, 12],
    });
  }

  if (includeWarranty && inv.warranty) {
    content.push({
      unbreakable: true,
      stack: [
        { text: inv.warranty.title, style: "h3", color: "#059669" },
        ...markdownBody(inv.warranty.bodyMarkdown),
      ],
      margin: [0, 8, 0, 16] as [number, number, number, number],
    });
  }

  return content;
};

const acceptPdfNote = (model: ProposalPrintModel): Content => ({
  unbreakable: true,
  stack: [
    {
      text: model.accept.pdfNote,
      style: "bodyMuted",
      fillColor: "#f8fafc",
      margin: [10, 10, 10, 10] as [number, number, number, number],
    },
  ],
  margin: [0, 16, 0, 0] as [number, number, number, number],
});

/** Contract appendix: proposal cover + legal terms (no duplicate accept boilerplate). */
const contractTermsBlock = (model: ProposalPrintModel): Content[] => {
  if (!model.terms?.markdown.trim()) return [];

  return [
    { text: "", pageBreak: "before" as const },
    heroBlock(model),
    { text: model.terms.title, style: "h2", margin: [0, 0, 0, 12] },
    ...markdownToPdfMakeContent(model.terms.markdown),
    acceptPdfNote(model),
  ];
};

export const buildProposalPdfDocument = (
  model: ProposalPrintModel,
): TDocumentDefinitions => {
  const hasContractTerms = Boolean(model.terms?.markdown.trim());
  const content: Content[] = [];

  if (!hasContractTerms) {
    content.push(heroBlock(model));
  }

  content.push(...introBlock(model));

  for (const section of model.sections) {
    content.push(...sectionHeader(section.kicker, section.title));
    content.push(...markdownBody(section.bodyMarkdown));
    content.push(...proposalPrintBlocksToPdfMake(section.blocks));
    content.push({ text: " ", margin: [0, 0, 0, 8] });
  }

  content.push(
    ...investmentBlock(model, { includeWarranty: !hasContractTerms }),
  );

  if (hasContractTerms) {
    content.push(...contractTermsBlock(model));
  } else {
    content.push(
      ...sectionHeader(model.accept.kicker, model.accept.title),
      ...markdownBody(model.accept.bodyMarkdown),
      acceptPdfNote(model),
    );
  }

  return {
    pageSize: "LETTER",
    pageMargins: [PAGE_MARGIN_H, PAGE_MARGIN_V, PAGE_MARGIN_H, PAGE_MARGIN_V],
    defaultStyle: {
      font: "Roboto",
      fontSize: 11,
      lineHeight: 1.35,
      color: "#334155",
    },
    styles: {
      kicker: {
        fontSize: 9,
        bold: true,
        color: "#1e5fa8",
        characterSpacing: 0.6,
        margin: [0, 18, 0, 6],
      },
      h2: {
        fontSize: 16,
        bold: true,
        color: "#0f172a",
        margin: [0, 0, 0, 10],
      },
      h3: {
        fontSize: 12,
        bold: true,
        color: "#0f172a",
        margin: [0, 8, 0, 6],
      },
      body: {
        fontSize: 11,
        lineHeight: 1.45,
        color: "#475569",
      },
      bodyMuted: {
        fontSize: 10,
        lineHeight: 1.45,
        color: "#64748b",
      },
      heroTag: {
        fontSize: 10,
        color: "#ffffff",
        margin: [0, 0, 0, 8],
      },
      heroTitle: {
        fontSize: 22,
        bold: true,
        color: "#ffffff",
        margin: [0, 0, 0, 8],
      },
      heroSubtitle: {
        fontSize: 11,
        color: "#e2e8f0",
        margin: [0, 0, 0, 4],
      },
      heroMetaLabel: {
        fontSize: 8,
        color: "#94a3b8",
        margin: [0, 0, 0, 4],
      },
      heroMetaValue: {
        fontSize: 10,
        bold: true,
        color: "#ffffff",
      },
    },
    content,
  };
};
