import type { LeadStageId } from "@/lbs/leads/leadStages";
import { getLeadStageDef } from "@/lbs/leads/leadStages";
import { LEAD_PIPELINE_NOTE_PREFIX } from "@/lbs/leads/leadFollowUpUtils";
import {
  formatFollowUpDateTimeLabel,
  toDateTimeLocalValue,
} from "@/lbs/leads/leadFollowUpDateTime";

export type LeadTransitionFieldType =
  | "text"
  | "textarea"
  | "select"
  | "date"
  | "datetime"
  | "number";

export type LeadTransitionField = {
  name: string;
  label: string;
  type: LeadTransitionFieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export type LeadTransitionConfig = {
  title: string;
  description: string;
  fields: LeadTransitionField[];
  followUpTaskFromField?: string;
  followUpTaskTitle?: (values: Record<string, string>) => string;
};

const CONTACT_METHODS = [
  { value: "call", label: "Phone call" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS / WhatsApp" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
] as const;

const PAUSE_REASONS = [
  { value: "waiting_client", label: "Waiting on client" },
  { value: "budget", label: "Budget / pricing" },
  { value: "timing", label: "Bad timing" },
  { value: "no_response", label: "No response" },
  { value: "other", label: "Other" },
] as const;

const LOSS_REASONS = [
  { value: "price", label: "Price" },
  { value: "competitor", label: "Chose a competitor" },
  { value: "timing", label: "Bad timing" },
  { value: "no_response", label: "Stopped responding" },
  { value: "not_fit", label: "Not a fit" },
  { value: "other", label: "Other" },
] as const;

export const LEAD_STAGE_TRANSITION_CONFIG: Record<
  LeadStageId,
  LeadTransitionConfig
> = {
  new: {
    title: "Move back to New",
    description:
      "Capture why this lead is going back to the top of the pipeline so the team does not lose context.",
    fields: [
      {
        name: "summary",
        label: "What changed?",
        type: "textarea",
        required: true,
        placeholder: "Why is this lead back at New?",
      },
    ],
  },
  contacted: {
    title: "Mark as Contacted",
    description:
      "First outreach is done. Log how you reached them and what happened so follow-up stays on track.",
    fields: [
      {
        name: "contactMethod",
        label: "How did you reach out?",
        type: "select",
        required: true,
        options: [...CONTACT_METHODS],
      },
      {
        name: "summary",
        label: "What happened?",
        type: "textarea",
        required: true,
        placeholder: "Brief outcome of the outreach…",
      },
      {
        name: "nextFollowUpDate",
        label: "Next follow-up date & time",
        type: "datetime",
        required: true,
      },
    ],
    followUpTaskFromField: "nextFollowUpDate",
    followUpTaskTitle: () => "Follow up with lead",
  },
  talking: {
    title: "Move to Talking",
    description:
      "There is an active conversation. Document the latest exchange and the next step.",
    fields: [
      {
        name: "summary",
        label: "Conversation update",
        type: "textarea",
        required: true,
        placeholder: "What did you discuss?",
      },
      {
        name: "nextStep",
        label: "Next step",
        type: "text",
        required: true,
        placeholder: "e.g. Send mockup, schedule site visit…",
      },
      {
        name: "nextFollowUpDate",
        label: "Next follow-up date & time",
        type: "datetime",
        required: true,
      },
    ],
    followUpTaskFromField: "nextFollowUpDate",
    followUpTaskTitle: (values) =>
      values.nextStep?.trim()
        ? `Follow up: ${values.nextStep.trim()}`
        : "Follow up with lead",
  },
  quoted: {
    title: "Move to Quoted",
    description:
      "A proposal or quote was sent. Record what went out and when to check back.",
    fields: [
      {
        name: "estimatedValue",
        label: "Quoted amount (optional)",
        type: "number",
        placeholder: "0.00",
      },
      {
        name: "summary",
        label: "What was sent?",
        type: "textarea",
        required: true,
        placeholder: "Proposal scope, link, or summary…",
      },
      {
        name: "nextFollowUpDate",
        label: "Check back on",
        type: "datetime",
        required: true,
      },
    ],
    followUpTaskFromField: "nextFollowUpDate",
    followUpTaskTitle: () => "Check proposal response",
  },
  closing: {
    title: "Move to Closing",
    description:
      "The deal is close. Capture blockers and the expected close date.",
    fields: [
      {
        name: "expectedCloseDate",
        label: "Expected close date & time",
        type: "datetime",
        required: true,
      },
      {
        name: "summary",
        label: "Closing update",
        type: "textarea",
        required: true,
        placeholder: "What is left to close? Any blockers?",
      },
    ],
    followUpTaskFromField: "expectedCloseDate",
    followUpTaskTitle: () => "Closing follow-up",
  },
  paused: {
    title: "Pause this lead",
    description:
      "Waiting on the prospect. Set when to pick this up again so it does not get lost.",
    fields: [
      {
        name: "pauseReason",
        label: "Why paused?",
        type: "select",
        required: true,
        options: [...PAUSE_REASONS],
      },
      {
        name: "resumeDate",
        label: "Resume follow-up on",
        type: "datetime",
        required: true,
      },
      {
        name: "summary",
        label: "Notes",
        type: "textarea",
        required: true,
        placeholder: "Context for when you return…",
      },
    ],
    followUpTaskFromField: "resumeDate",
    followUpTaskTitle: () => "Resume paused lead",
  },
  won: {
    title: "Mark as Won",
    description:
      "This lead is ready to convert. Add a quick win note, then use Convert to client in the header.",
    fields: [
      {
        name: "summary",
        label: "Win summary (optional)",
        type: "textarea",
        placeholder: "What closed the deal?",
      },
    ],
  },
  lost: {
    title: "Mark as Lost",
    description:
      "This lead is not moving forward. Capture why so the team learns from it.",
    fields: [
      {
        name: "lossReason",
        label: "Primary reason",
        type: "select",
        required: true,
        options: [...LOSS_REASONS],
      },
      {
        name: "summary",
        label: "What happened?",
        type: "textarea",
        required: true,
        placeholder: "Final outcome and lessons…",
      },
    ],
  },
};

export const getLeadStageTransitionConfig = (toStage: LeadStageId) =>
  LEAD_STAGE_TRANSITION_CONFIG[toStage];

export const buildTransitionNoteText = ({
  fromStage,
  toStage,
  values,
}: {
  fromStage: LeadStageId;
  toStage: LeadStageId;
  values: Record<string, string>;
}) => {
  const fromLabel = getLeadStageDef(fromStage).label;
  const toLabel = getLeadStageDef(toStage).label;
  const config = getLeadStageTransitionConfig(toStage);
  const lines = [`${LEAD_PIPELINE_NOTE_PREFIX} ${fromLabel} → ${toLabel}`];

  for (const field of config.fields) {
    const raw = values[field.name]?.trim();
    if (!raw) continue;
    if (field.type === "select") {
      const label =
        field.options?.find((option) => option.value === raw)?.label ?? raw;
      lines.push(`${field.label}: ${label}`);
      continue;
    }
    if (field.type === "datetime") {
      lines.push(`${field.label}: ${formatFollowUpDateTimeLabel(raw)}`);
      continue;
    }
    lines.push(`${field.label}: ${raw}`);
  }

  return lines.join("\n");
};

const FOLLOW_UP_CONTEXT_LABELS: Record<string, string> = {
  summary: "Qué pasó",
  nextStep: "Siguiente paso",
  contactMethod: "Cómo contactaste",
  estimatedValue: "Monto cotizado",
  pauseReason: "Motivo de pausa",
  lossReason: "Motivo de pérdida",
};

/** Human-readable context from the pipeline wizard — used in calendar + SMS. */
export const buildFollowUpContextDescription = (
  toStage: LeadStageId,
  values: Record<string, string>,
): string => {
  const config = getLeadStageTransitionConfig(toStage);
  const lines: string[] = [];

  for (const field of config.fields) {
    if (field.type === "datetime" || field.type === "date") continue;
    const raw = values[field.name]?.trim();
    if (!raw) continue;

    const label = FOLLOW_UP_CONTEXT_LABELS[field.name] ?? field.label;
    if (field.type === "select") {
      const optionLabel =
        field.options?.find((option) => option.value === raw)?.label ?? raw;
      lines.push(`${label}: ${optionLabel}`);
      continue;
    }
    if (field.type === "number") {
      lines.push(`${label}: $${raw}`);
      continue;
    }
    lines.push(`${label}: ${raw}`);
  }

  return lines.join("\n");
};

export const buildFollowUpCalendarDescription = ({
  fromStage,
  toStage,
  values,
}: {
  fromStage: LeadStageId;
  toStage: LeadStageId;
  values: Record<string, string>;
}) => {
  const context = buildFollowUpContextDescription(toStage, values);
  const stageLine = `${getLeadStageDef(fromStage).label} → ${getLeadStageDef(toStage).label}`;
  return context ? `${stageLine}\n${context}` : stageLine;
};

export const getDefaultTransitionValues = (
  toStage: LeadStageId,
): Record<string, string> => {
  const config = getLeadStageTransitionConfig(toStage);
  const defaults: Record<string, string> = {};

  for (const field of config.fields) {
    if (field.type === "datetime") {
      const date = new Date();
      date.setDate(date.getDate() + (toStage === "contacted" ? 3 : 7));
      date.setHours(10, 0, 0, 0);
      defaults[field.name] = toDateTimeLocalValue(date);
    } else if (field.type === "date") {
      const date = new Date();
      date.setDate(date.getDate() + (toStage === "contacted" ? 3 : 7));
      defaults[field.name] = date.toISOString().slice(0, 10);
    } else {
      defaults[field.name] = "";
    }
  }

  return defaults;
};
