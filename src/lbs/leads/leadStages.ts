/**
 * Lead pipeline stages used by the Kanban view. The column ids must match
 * `public.contacts.lead_stage` values written by the anti-olvido system and
 * the deals -> leads sync trigger (`won`, `lost` are terminal and get a
 * `snooze_until = 2099-12-31` to take them out of follow-up).
 *
 * Order here defines column order in the Kanban.
 */
export type LeadStageId =
  | "new"
  | "contacted"
  | "talking"
  | "quoted"
  | "closing"
  | "paused"
  | "won"
  | "lost";

export type LeadStageDef = {
  id: LeadStageId;
  label: string;
  description: string;
  color: string;
  terminal?: boolean;
};

export const LBS_LEAD_KANBAN_STAGES: readonly LeadStageDef[] = Object.freeze([
  {
    id: "new",
    label: "New",
    description: "Just created, not contacted yet",
    color: "#94a3b8",
  },
  {
    id: "contacted",
    label: "Contacted",
    description: "First outreach completed",
    color: "#3b82f6",
  },
  {
    id: "talking",
    label: "Talking",
    description: "Active conversation",
    color: "#8b5cf6",
  },
  {
    id: "quoted",
    label: "Quoted",
    description: "Proposal sent",
    color: "#f59e0b",
  },
  {
    id: "closing",
    label: "Closing",
    description: "Close is imminent",
    color: "#ec4899",
  },
  {
    id: "paused",
    label: "Paused",
    description: "Waiting on the prospect",
    color: "#a3a3a3",
  },
  {
    id: "won",
    label: "Won",
    description: "Converted (terminal)",
    color: "#22c55e",
    terminal: true,
  },
  {
    id: "lost",
    label: "Lost",
    description: "Not moving forward (terminal)",
    color: "#ef4444",
    terminal: true,
  },
]);

/** Best-effort coercion: anything outside the known set falls back to "new". */
export const normalizeLeadStage = (value: unknown): LeadStageId => {
  if (typeof value !== "string") return "new";
  const match = LBS_LEAD_KANBAN_STAGES.find((stage) => stage.id === value);
  return match ? match.id : "new";
};

export const getLeadStageDef = (
  id: string | null | undefined,
): LeadStageDef => {
  const found = LBS_LEAD_KANBAN_STAGES.find((stage) => stage.id === id);
  return found ?? LBS_LEAD_KANBAN_STAGES[0];
};
