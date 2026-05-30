import type { Contact, ContactNote } from "@/components/atomic-crm/types";
import { formatFollowUpDateTimeLabel } from "@/lbs/leads/leadFollowUpDateTime";

export const LEAD_PIPELINE_NOTE_PREFIX = "Pipeline:";

export const isPipelineTransitionNote = (note: Pick<ContactNote, "text">) =>
  note.text?.trimStart().startsWith(LEAD_PIPELINE_NOTE_PREFIX) ?? false;

export const isLeadTerminalStage = (leadStage?: string | null) =>
  leadStage === "won" || leadStage === "lost";

export const isFollowUpOverdue = (value?: string | null) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
};

export const formatFollowUpDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const hasExplicitTime =
    value.includes("T") &&
    !(date.getHours() === 0 && date.getMinutes() === 0 && value.endsWith("T00:00:00.000Z"));

  if (hasExplicitTime || value.includes("T")) {
    return formatFollowUpDateTimeLabel(value);
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const getLeadNextFollowUpAt = (contact: Contact) =>
  contact.next_followup_at ?? null;
