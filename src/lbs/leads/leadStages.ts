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
    label: "Nuevo",
    description: "Recién creados, sin contacto aún",
    color: "#94a3b8",
  },
  {
    id: "contacted",
    label: "Contactado",
    description: "Primer contacto hecho",
    color: "#3b82f6",
  },
  {
    id: "talking",
    label: "Conversando",
    description: "En conversación activa",
    color: "#8b5cf6",
  },
  {
    id: "quoted",
    label: "Cotizado",
    description: "Propuesta enviada",
    color: "#f59e0b",
  },
  {
    id: "closing",
    label: "Cerrando",
    description: "Cierre inminente",
    color: "#ec4899",
  },
  {
    id: "paused",
    label: "Pausado",
    description: "En espera del cliente",
    color: "#a3a3a3",
  },
  {
    id: "won",
    label: "Ganado",
    description: "Convertido (terminal)",
    color: "#22c55e",
    terminal: true,
  },
  {
    id: "lost",
    label: "Perdido",
    description: "No avanza (terminal)",
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
