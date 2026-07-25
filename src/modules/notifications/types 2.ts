export type NotificationCategory =
  | "messages_sms"
  | "messages_internal"
  | "tickets_message"
  | "tickets_assigned"
  | "tasks_mention"
  | "tasks_rescheduled"
  | "leads_followup_due"
  | "leads_stale"
  | "bookings_new";

export type NotificationPrefs = {
  sound_enabled: boolean;
  desktop_enabled: boolean;
  messages_sms: boolean;
  messages_internal: boolean;
  tickets_message: boolean;
  tickets_assigned: boolean;
  tasks_mention: boolean;
  tasks_rescheduled: boolean;
  leads_followup_due: boolean;
  leads_stale: boolean;
  bookings_new: boolean;
};

export type NotificationHistoryItem = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href?: string;
  /** Stable key for deduplicating repeated alerts (e.g. same ticket assignment). */
  tag?: string;
  created_at: string;
  read: boolean;
};

export const NOTIFICATION_CATEGORY_LABELS: Record<
  NotificationCategory,
  { label: string; description: string }
> = {
  messages_sms: {
    label: "Inbound SMS",
    description: "When a client replies by text message.",
  },
  messages_internal: {
    label: "Team messages",
    description: "Direct messages and internal project chat.",
  },
  tickets_message: {
    label: "Ticket replies",
    description: "New messages on tickets assigned to you.",
  },
  tickets_assigned: {
    label: "Ticket assignments",
    description: "When a ticket is assigned to you.",
  },
  tasks_mention: {
    label: "Task mentions",
    description: "When someone tags you on a task.",
  },
  tasks_rescheduled: {
    label: "Task due date changes",
    description: "When a task you own or follow gets a new due date.",
  },
  leads_followup_due: {
    label: "Lead follow-up due",
    description: "When a lead follow-up date has passed.",
  },
  leads_stale: {
    label: "Stale leads",
    description: "Leads with no activity for 4+ days (Anti-Olvido).",
  },
  bookings_new: {
    label: "New bookings",
    description:
      "When someone books an appointment through your Book Now link.",
  },
};
