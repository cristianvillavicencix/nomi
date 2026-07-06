import {
  getLeadKanbanShowPath,
  getLeadsListPath,
} from "@/app/routing";
import type { Contact } from "@/components/atomic-crm/types";
import {
  LBS_LEAD_KANBAN_BOARD_STAGES,
  type LeadStageId,
  normalizeLeadStage,
} from "@/modules/leads/leadStages";
import { isLeadTerminalStage } from "@/modules/leads/leadFollowUpUtils";

const BOARD_STAGE_IDS = new Set(
  LBS_LEAD_KANBAN_BOARD_STAGES.map((stage) => stage.id),
);

export const isKanbanBoardStage = (
  value: unknown,
): value is LeadStageId =>
  typeof value === "string" && BOARD_STAGE_IDS.has(value as LeadStageId);

export const parseKanbanStageParam = (value: string | null): LeadStageId | null =>
  isKanbanBoardStage(value) ? value : null;

export const countLeadsByBoardStage = (leads: Contact[]) => {
  const counts = Object.fromEntries(
    LBS_LEAD_KANBAN_BOARD_STAGES.map((stage) => [stage.id, 0]),
  ) as Record<LeadStageId, number>;

  for (const lead of leads) {
    if (isLeadTerminalStage(lead.lead_stage)) continue;
    const stage = normalizeLeadStage(lead.lead_stage);
    if (isKanbanBoardStage(stage)) {
      counts[stage] += 1;
    }
  }

  return counts;
};

export const filterLeadsForKanbanStage = (
  leads: Contact[],
  stage: LeadStageId,
) =>
  leads.filter((lead) => {
    if (isLeadTerminalStage(lead.lead_stage)) return false;
    return normalizeLeadStage(lead.lead_stage) === stage;
  });

export const leadKanbanShowPath = (
  contactId: string | number,
  stage: LeadStageId,
) => getLeadKanbanShowPath(contactId, stage);

export const leadsKanbanBoardPath = () => getLeadsListPath();
