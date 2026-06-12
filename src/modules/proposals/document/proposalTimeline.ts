import type { ProposalTimelineBar } from "@/modules/proposals/document/proposalDocumentTypes";

export const DEFAULT_PROPOSAL_TIMELINE_BARS: ProposalTimelineBar[] = [
  {
    id: "timeline-1",
    label: "Discovery",
    week_label: "W1",
    left_percent: 0,
    width_percent: 20,
    tone: "light",
  },
  {
    id: "timeline-2",
    label: "Design",
    week_label: "W1–2",
    left_percent: 15,
    width_percent: 25,
    tone: "brand",
  },
  {
    id: "timeline-3",
    label: "Build & code",
    week_label: "W2–4",
    left_percent: 30,
    width_percent: 45,
    tone: "dark",
  },
  {
    id: "timeline-4",
    label: "Review",
    week_label: "W4–5",
    left_percent: 70,
    width_percent: 20,
    tone: "brand",
  },
  {
    id: "timeline-5",
    label: "Launch 🚀",
    week_label: "W5",
    left_percent: 88,
    width_percent: 12,
    tone: "gold",
  },
];

const isTone = (value: unknown): value is ProposalTimelineBar["tone"] =>
  value === "light" ||
  value === "brand" ||
  value === "dark" ||
  value === "gold";

export const parseProposalTimelineBars = (
  value: unknown,
): ProposalTimelineBar[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const bars = value
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      if (!label) return null;
      const week_label =
        typeof record.week_label === "string" ? record.week_label.trim() : "";
      const left = Number(record.left_percent);
      const width = Number(record.width_percent);
      return {
        id:
          typeof record.id === "string" && record.id.trim()
            ? record.id.trim()
            : `timeline-${index + 1}`,
        label,
        week_label: week_label || `W${index + 1}`,
        left_percent: Number.isFinite(left) ? Math.max(0, Math.min(100, left)) : 0,
        width_percent: Number.isFinite(width)
          ? Math.max(4, Math.min(100, width))
          : 20,
        tone: isTone(record.tone) ? record.tone : "brand",
      } satisfies ProposalTimelineBar;
    })
    .filter((row): row is ProposalTimelineBar => row != null);
  return bars.length > 0 ? bars : undefined;
};

export const resolveProposalTimelineBars = (
  bars: ProposalTimelineBar[] | undefined,
): ProposalTimelineBar[] =>
  bars?.length ? bars : DEFAULT_PROPOSAL_TIMELINE_BARS;

/** Week range shown on the bar — derived from bar position when week_label is empty. */
export const weekLabelFromBar = (bar: ProposalTimelineBar) => {
  const start = Math.max(1, Math.floor(bar.left_percent / 20) + 1);
  const end = Math.max(
    start,
    Math.ceil((bar.left_percent + bar.width_percent) / 20),
  );
  return start === end ? `W${start}` : `W${start}–${end}`;
};

export const TIMELINE_TONE_PDF_COLORS: Record<
  ProposalTimelineBar["tone"],
  { fill: string; text: string }
> = {
  light: { fill: "#3b82d4", text: "#ffffff" },
  brand: { fill: "#1e5fa8", text: "#ffffff" },
  dark: { fill: "#0d3b6e", text: "#ffffff" },
  gold: { fill: "#f59e0b", text: "#3a2800" },
};

export const newTimelineBarId = () =>
  `timeline-${Date.now().toString(36)}`;
