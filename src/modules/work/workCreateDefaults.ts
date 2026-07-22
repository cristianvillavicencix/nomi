import type { Identifier } from "ra-core";
import { DEFAULT_MEETING_DURATION_MINUTES } from "@/modules/calendar/calendarReminderOptions";
import {
  isMeetingCreateCategory,
  isScheduledEventCreateCategory,
  isTaskCreateCategory,
  type WorkCreateCategory,
} from "@/modules/work/workCreateCategories";

export const getWorkCreateResource = (category: WorkCreateCategory) =>
  isTaskCreateCategory(category) ? ("tasks" as const) : ("calendar_events" as const);

export const buildWorkCreateRecord = (
  category: WorkCreateCategory,
  {
    dateKey,
    initialTime = null,
    dealId,
    memberId,
  }: {
    dateKey: string;
    initialTime?: string | null;
    dealId?: Identifier;
    memberId: Identifier;
  },
) => {
  if (isTaskCreateCategory(category)) {
    return {
      type: "none",
      company_id: null,
      deal_id: dealId ?? null,
      contact_id: null,
      due_date: dateKey,
      due_time: initialTime,
      organization_member_id: memberId,
      assignee_person_ids: [memberId],
      collaborator_person_ids: [],
      reminder_offsets_minutes: [15],
      internal: false,
    };
  }

  if (isMeetingCreateCategory(category)) {
    return {
      title: "",
      event_date: dateKey,
      event_time: initialTime,
      duration_minutes: DEFAULT_MEETING_DURATION_MINUTES,
      reminder_offsets_minutes: [15],
      remind_before_minutes: 15,
      description: "",
      meeting_format: "video",
      meeting_url: null,
      location: null,
      company_id: null,
      contact_id: null,
      deal_id: dealId ?? null,
      organization_member_id: memberId,
      assignee_member_ids: [memberId],
      completed_at: null,
    };
  }

  return {
    title: "",
    event_date: dateKey,
    event_time: initialTime,
    duration_minutes: null,
    reminder_offsets_minutes: isScheduledEventCreateCategory(category) ? [15] : [],
    remind_before_minutes: isScheduledEventCreateCategory(category) ? 15 : null,
    description: "",
    company_id: null,
    contact_id: null,
    deal_id: dealId ?? null,
    organization_member_id: memberId,
    assignee_member_ids: [memberId],
    completed_at: null,
  };
};
