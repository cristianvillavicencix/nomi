import { useMemo } from "react";

import { Switch } from "@/components/ui/switch";
import { TICKET_REPLY_TEMPLATES } from "@/modules/tickets/ticketReplyTemplates";
import { useTicketWorkspaceSettingsContext } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

export const TicketBuiltinTemplatesSection = () => {
  const { data, patchInbox } = useTicketWorkspaceSettingsContext();
  const inbox = useMemo(
    () => data?.inboxes.find((row) => row.is_default) ?? data?.inboxes[0],
    [data?.inboxes],
  );

  if (!inbox) return null;

  const disabled = new Set(inbox.disabled_builtin_reply_template_ids ?? []);

  const toggle = (templateId: string, enabled: boolean) => {
    const next = new Set(disabled);
    if (enabled) next.delete(templateId);
    else next.add(templateId);
    void patchInbox({
      id: inbox.id,
      disabled_builtin_reply_template_ids: [...next],
    });
  };

  return (
    <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Built-in reply templates</p>
        <p className="text-xs text-muted-foreground">
          Toggle which system templates appear in the ticket composer.
        </p>
      </div>
      <ul className="space-y-2 text-sm">
        {TICKET_REPLY_TEMPLATES.map((template) => (
          <li
            key={template.id}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <div>
              <p className="font-medium">{template.label}</p>
              <p className="text-xs text-muted-foreground">{template.description}</p>
            </div>
            <Switch
              checked={!disabled.has(template.id)}
              onCheckedChange={(checked) => toggle(template.id, checked)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
};
