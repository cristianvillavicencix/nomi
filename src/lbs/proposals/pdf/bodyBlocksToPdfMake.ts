import type { Content } from "pdfmake/interfaces";
import type {
  ProposalPrintBlock,
  ProposalPrintTimelineBar,
} from "@/lbs/proposals/pdf/proposalPrintTypes";
import { TIMELINE_TONE_PDF_COLORS } from "@/lbs/proposals/document/proposalTimeline";

const TIMELINE_TRACK_W = 340;
const TIMELINE_TRACK_H = 28;
const TIMELINE_LABEL_W = 108;

const timelineBarsToPdfMake = (bars: ProposalPrintTimelineBar[]): Content[] =>
  bars.map((bar) => {
    const colors = TIMELINE_TONE_PDF_COLORS[bar.tone];
    const barX = (bar.leftPercent / 100) * TIMELINE_TRACK_W;
    const barW = Math.max(
      28,
      (bar.widthPercent / 100) * TIMELINE_TRACK_W,
    );

    return {
      columns: [
        {
          width: TIMELINE_LABEL_W,
          text: bar.label,
          fontSize: 10,
          bold: true,
          color: "#475569",
          margin: [0, 8, 8, 0] as [number, number, number, number],
        },
        {
          width: TIMELINE_TRACK_W,
          canvas: [
            {
              type: "rect",
              x: 0,
              y: 0,
              w: TIMELINE_TRACK_W,
              h: TIMELINE_TRACK_H,
              r: 4,
              color: "#f1f5f9",
            },
            {
              type: "rect",
              x: barX,
              y: 4,
              w: barW,
              h: 20,
              r: 4,
              color: colors.fill,
            },
            {
              type: "text",
              x: barX + 8,
              y: 10,
              text: bar.weekLabel,
              fontSize: 8,
              color: colors.text,
            },
          ],
        },
      ],
      columnGap: 8,
      margin: [0, 0, 0, 6] as [number, number, number, number],
    };
  });

export const proposalPrintBlocksToPdfMake = (
  blocks: ProposalPrintBlock[],
): Content[] =>
  blocks.flatMap((block) => {
    if (block.type === "stats") {
      return [
        {
          table: {
            widths: Array(block.rows.length).fill("*"),
            body: [
              block.rows.map((row) => ({
                text: row.value,
                alignment: "center" as const,
                bold: true,
                fontSize: 18,
                color: "#1e5fa8",
                margin: [4, 10, 4, 4] as [number, number, number, number],
              })),
              block.rows.map((row) => ({
                text: row.label,
                alignment: "center" as const,
                fontSize: 9,
                color: "#64748b",
                margin: [4, 0, 4, 10] as [number, number, number, number],
              })),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: (i: number, node: { table: { widths: string[] } }) =>
              i > 0 && i < node.table.widths.length ? 0.5 : 0,
            hLineColor: () => "#e2e8f0",
            vLineColor: () => "#e2e8f0",
          },
          margin: [0, 8, 0, 16] as [number, number, number, number],
        },
      ];
    }

    if (block.type === "team") {
      return [
        {
          text: "The team behind your project",
          style: "h3",
          margin: [0, 12, 0, 8] as [number, number, number, number],
        },
        ...block.members.map((member) => ({
          unbreakable: true,
          stack: [
            { text: member.name, bold: true, fontSize: 10, color: "#0f172a" },
            {
              text: member.role,
              fontSize: 9,
              color: "#1e5fa8",
              margin: [0, 2, 0, 0] as [number, number, number, number],
            },
            ...(member.bio
              ? [
                  {
                    text: member.bio,
                    fontSize: 9,
                    color: "#475569",
                    lineHeight: 1.4,
                  },
                ]
              : []),
          ],
          margin: [0, 0, 0, 10] as [number, number, number, number],
        })),
      ];
    }

    if (block.type === "client_logos") {
      return [
        {
          text: "Companies we've worked with",
          style: "h3",
          margin: [0, 8, 0, 6] as [number, number, number, number],
        },
        {
          ul: block.logos.map((logo) => logo.name || "Partner"),
          fontSize: 10,
          color: "#475569",
          margin: [0, 0, 0, 12] as [number, number, number, number],
        },
      ];
    }

    if (block.type === "portfolio") {
      return block.items.map((item) => ({
        unbreakable: true,
        text: [
          { text: item.title, bold: true },
          item.subtitle
            ? {
                text: ` · ${item.subtitle}`,
                color: "#64748b",
                fontSize: 10,
              }
            : "",
        ],
        margin: [0, 0, 0, 12] as [number, number, number, number],
      }));
    }

    if (block.type === "reviews") {
      return block.items.map((review) => ({
        unbreakable: true,
        stack: [
          {
            text: "★".repeat(Math.min(5, review.rating)),
            color: "#f59e0b",
            fontSize: 10,
            margin: [0, 0, 0, 4] as [number, number, number, number],
          },
          { text: review.text, style: "body" },
          {
            text: review.author,
            fontSize: 9,
            bold: true,
            color: "#0f172a",
            margin: [0, 6, 0, 12] as [number, number, number, number],
          },
        ],
      }));
    }

    if (block.type === "timeline") {
      return timelineBarsToPdfMake(block.bars);
    }

    return [];
  });
