import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TICKET_REPLY_TEMPLATES } from "@/modules/tickets/ticketReplyTemplates";
import { TICKET_CREATE_TEMPLATES } from "@/modules/tickets/ticketCreateTemplates";
import { TicketSettingsPanelShell } from "@/modules/settings/tickets/TicketSettingsPanelShell";
import { useTicketWorkspaceSettingsContext } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

export const TicketTemplatesExtrasPanel = () => {
  const { data, patchInbox } = useTicketWorkspaceSettingsContext();
  const inbox = useMemo(
    () => data?.inboxes.find((row) => row.is_default) ?? data?.inboxes[0],
    [data?.inboxes],
  );

  if (!inbox) return null;

  const disabled = new Set(inbox.disabled_builtin_reply_template_ids ?? []);
  const createTemplates =
    inbox.create_templates?.length > 0
      ? inbox.create_templates
      : TICKET_CREATE_TEMPLATES.map((template) => ({
          id: template.id,
          label: template.label,
          description: template.description,
          body: template.body,
        }));

  const toggleBuiltin = (templateId: string, enabled: boolean) => {
    const next = new Set(disabled);
    if (enabled) next.delete(templateId);
    else next.add(templateId);
    void patchInbox({
      id: inbox.id,
      disabled_builtin_reply_template_ids: [...next],
    });
  };

  const seedCreateTemplates = () => {
    void patchInbox({
      id: inbox.id,
      create_templates: TICKET_CREATE_TEMPLATES.map((template) => ({
        id: template.id,
        label: template.label,
        description: template.description,
        body: template.body,
      })),
    });
  };

  return (
    <TicketSettingsPanelShell
      title="Template library"
      description="Built-in reply templates and new-ticket composer templates."
    >
      <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
        <p className="text-sm font-medium">Built-in reply templates</p>
        <p className="text-xs text-muted-foreground">
          Custom reply templates are on the Reply templates tab. Toggle built-ins here.
        </p>
        <ul className="space-y-2 text-sm">
          {TICKET_REPLY_TEMPLATES.map((template) => {
            const enabled = !disabled.has(template.id);
            return (
              <li
                key={template.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div>
                  <p className="font-medium">{template.label}</p>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => toggleBuiltin(template.id, checked)}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
        <p className="text-sm font-medium">New ticket composer templates</p>
        <ul className="space-y-2 text-sm">
          {createTemplates.map((template) => (
            <li key={template.id} className="rounded-md border px-3 py-2">
              <p className="font-medium">{template.label}</p>
              {template.description ? (
                <p className="text-xs text-muted-foreground">{template.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
        {inbox.create_templates?.length === 0 ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
            onClick={seedCreateTemplates}
          >
            Copy defaults into this inbox (editable via API)
          </Button>
        ) : null}
      </section>
    </TicketSettingsPanelShell>
  );
};
