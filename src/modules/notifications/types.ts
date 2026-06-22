export type NotificationCategory =
  | "messages_sms"
  | "messages_internal"
  | "tickets_message"
  | "tickets_assigned"
  | "tasks_mention"
  | "leads_followup_due"
  | "leads_stale";

export type NotificationPrefs = {
  sound_enabled: boolean;
  desktop_enabled: boolean;
  messages_sms: boolean;
  messages_internal: boolean;
  tickets_message: boolean;
  tickets_assigned: boolean;
  tasks_mention: boolean;
  leads_followup_due: boolean;
  leads_stale: boolean;
};

export type NotificationHistoryItem = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href?: string;
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
  leads_followup_due: {
    label: "Lead follow-up due",
    description: "When a lead follow-up date has passed.",
  },
  leads_stale: {
    label: "Stale leads",
    description: "Leads with no activity for 4+ days (Anti-Olvido).",
  },
};
