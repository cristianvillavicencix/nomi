import type { DataProvider, Identifier } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { normalizeTaskCreateData } from "@/components/atomic-crm/tasks/taskConstants";
import { prepareCalendarEventWriteData } from "@/lbs/calendar/calendarEventWriteData";
import { parseFollowUpDateTime } from "@/lbs/leads/leadFollowUpDateTime";
import {
  buildFollowUpCalendarDescription,
  buildTransitionNoteText,
  getLeadStageTransitionConfig,
} from "@/lbs/leads/leadStageTransitionConfig";
import {
  getLeadStageDef,
  normalizeLeadStage,
  type LeadStageId,
} from "@/lbs/leads/leadStages";

const FROZEN_SNOOZE = "2099-12-31T00:00:00+00:00";

export type ApplyLeadStageChangeInput = {
  dataProvider: DataProvider;
  update: (
    resource: string,
    params: {
      id: Identifier;
      data: Partial<Contact>;
      previousData: Contact;
    },
  ) => Promise<unknown>;
  lead: Contact;
  toStage: LeadStageId;
  values: Record<string, string>;
  organizationMemberId: Identifier;
  noteStatus?: string;
};

export const applyLeadStageChange = async ({
  dataProvider,
  update,
  lead,
  toStage,
  values,
  organizationMemberId,
  noteStatus = "pending",
}: ApplyLeadStageChangeInput) => {
  const fromStage = normalizeLeadStage(lead.lead_stage);
  const config = getLeadStageTransitionConfig(toStage);
  const noteText = buildTransitionNoteText({ fromStage, toStage, values });

  const contactPatch: Partial<Contact> & Record<string, unknown> = {
    lead_stage: toStage,
    last_seen: new Date().toISOString(),
  };

  if (toStage === "won" || toStage === "lost") {
    contactPatch.snooze_until = FROZEN_SNOOZE;
  } else if (fromStage === "won" || fromStage === "lost") {
    contactPatch.snooze_until = null;
  }

  const followUpRaw =
    (config.followUpTaskFromField
      ? values[config.followUpTaskFromField]?.trim()
      : "") ||
    values.nextFollowUpDate?.trim() ||
    values.expectedCloseDate?.trim() ||
    values.resumeDate?.trim();

  const followUp = followUpRaw ? parseFollowUpDateTime(followUpRaw) : null;

  if (toStage === "paused" && followUp) {
    contactPatch.snooze_until = followUp.iso;
  }

  if (toStage === "quoted" && values.estimatedValue?.trim()) {
    const parsed = Number(values.estimatedValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      contactPatch.lead_value_estimate = parsed;
    }
  }

  if (followUp && toStage !== "won" && toStage !== "lost") {
    contactPatch.next_followup_at = followUp.iso;
  }

  if (toStage === "contacted" || toStage === "talking") {
    contactPatch.last_contacted_at = new Date().toISOString();
  }

  await update("contacts", {
    id: lead.id,
    data: contactPatch as Partial<Contact>,
    previousData: lead,
  });

  if (noteText.trim()) {
    await dataProvider.create("contact_notes", {
      data: {
        contact_id: lead.id,
        text: noteText,
        date: new Date().toISOString(),
        organization_member_id: organizationMemberId,
        status: noteStatus,
      },
    });
  }

  if (
    followUp &&
    config.followUpTaskFromField &&
    toStage !== "won" &&
    toStage !== "lost"
  ) {
    const taskTitle =
      config.followUpTaskTitle?.(values) ??
      `Follow up — ${getLeadStageDef(toStage).label}`;

    await dataProvider.create("tasks", {
      data: normalizeTaskCreateData({
        contact_id: lead.id,
        text: taskTitle,
        due_date: followUp.dateKey,
        type: "call",
        priority: toStage === "closing" ? "high" : "normal",
        organization_member_id: organizationMemberId,
      }),
    });

    const calendarResult = await dataProvider.create("calendar_events", {
      data: prepareCalendarEventWriteData({
        title: taskTitle,
        event_date: followUp.dateKey,
        event_time: followUp.timeKey,
        duration_minutes: 30,
        remind_before_minutes: 15,
        description: buildFollowUpCalendarDescription({
          fromStage,
          toStage,
          values,
        }),
        contact_id: lead.id,
        company_id: lead.company_id ?? null,
        deal_id: null,
        person_id: null,
        meeting_url: null,
        organization_member_id: organizationMemberId,
        completed_at: null,
      }),
    });

    const calendarEventId = (calendarResult?.data as { id?: Identifier } | undefined)
      ?.id;
    const provider = dataProvider as CrmDataProvider;
    if (calendarEventId != null && provider.notifyFollowUp) {
      try {
        await provider.notifyFollowUp({
          calendarEventId,
          kind: "scheduled",
          appBaseUrl:
            typeof window !== "undefined" ? window.location.origin : null,
        });
      } catch (error) {
        console.warn("[applyLeadStageChange] follow-up SMS failed", error);
      }
    }
  }
};
