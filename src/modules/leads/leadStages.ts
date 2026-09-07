import { toneCssValue, type Tone } from "@/modules/shared/status";

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
  tone: Tone;
  /** CSS token for inline Kanban styles (`var(--info)`, etc.). */
  color: string;
  terminal?: boolean;
};

const stage = (
  id: LeadStageId,
  label: string,
  description: string,
  tone: Tone,
  terminal?: boolean,
): LeadStageDef => ({
  id,
  label,
  description,
  tone,
  color: toneCssValue(tone),
  ...(terminal ? { terminal: true } : {}),
});

export const LBS_LEAD_KANBAN_STAGES: readonly LeadStageDef[] = Object.freeze([
  stage("new", "New", "Just created, not contacted yet", "muted"),
  stage("contacted", "Contacted", "First outreach completed", "info"),
  stage("talking", "Talking", "Active conversation", "brand"),
  stage("quoted", "Quoted", "Proposal sent", "warning"),
  stage("closing", "Closing", "Close is imminent", "warning"),
  stage("paused", "Paused", "Waiting on the prospect", "muted"),
  stage("won", "Won", "Converted (terminal)", "success", true),
  stage("lost", "Lost", "Not moving forward (terminal)", "destructive", true),
]);

/** Active pipeline columns shown on the leads Kanban board (excludes Won/Lost). */
export const LBS_LEAD_KANBAN_BOARD_STAGES: readonly LeadStageDef[] =
  LBS_LEAD_KANBAN_STAGES.filter((stage) => !stage.terminal);

/** Terminal outcome stages — actions only, not Kanban columns. */
export const LBS_LEAD_OUTCOME_STAGES: readonly LeadStageDef[] =
  LBS_LEAD_KANBAN_STAGES.filter((stage) => stage.terminal);

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
