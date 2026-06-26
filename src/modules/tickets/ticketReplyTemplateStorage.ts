import type { TicketInboxReplyTemplate } from "@/modules/types";
import type { TicketReplyTemplate } from "@/modules/tickets/ticketReplyTemplates";
import { TICKET_REPLY_TEMPLATES } from "@/modules/tickets/ticketReplyTemplates";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

export const parseInboxReplyTemplates = (
  raw: unknown,
): TicketInboxReplyTemplate[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const label = typeof row.label === "string" ? row.label.trim() : "";
      const body = typeof row.body === "string" ? row.body.trim() : "";
      if (!id || !label || !body) return null;
      const description =
        typeof row.description === "string" ? row.description.trim() : null;
      return { id, label, description, body };
    })
    .filter((row): row is TicketInboxReplyTemplate => row != null);
};

export const mergeTicketReplyTemplates = (
  custom: TicketInboxReplyTemplate[] = [],
): TicketReplyTemplate[] => [
  ...TICKET_REPLY_TEMPLATES,
  ...custom.map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description?.trim() || "Custom template",
    body: row.body,
  })),
];

export const createInboxReplyTemplateId = () => `custom-${crypto.randomUUID()}`;

export const persistInboxReplyTemplates = async (
  inboxId: number | string,
  templates: TicketInboxReplyTemplate[],
) => {
  const { data, error } = await supabase
    .from("ticket_inboxes")
    .update({ reply_templates: templates })
    .eq("id", inboxId)
    .select("id, email, display_name, reply_templates")
    .single();

  if (error) throw error;
  return data;
};
