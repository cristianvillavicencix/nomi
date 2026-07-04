import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";
import { TicketSettingsPanelShell } from "@/modules/settings/tickets/TicketSettingsPanelShell";
import { useTicketWorkspaceSettingsContext } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

export const TicketWorkflowPanel = () => {
  const { data, patchWorkspace, saving } = useTicketWorkspaceSettingsContext();
  const workspace = data?.workspace;
  const [tagDraft, setTagDraft] = useState("");
  const [statusValue, setStatusValue] = useState("");
  const [statusLabel, setStatusLabel] = useState("");

  if (!workspace) return null;

  const addTag = () => {
    const tag = tagDraft.trim().toLowerCase();
    if (!tag || workspace.allowed_ticket_tags.includes(tag)) return;
    void patchWorkspace({
      allowed_ticket_tags: [...workspace.allowed_ticket_tags, tag],
    });
    setTagDraft("");
  };

  const addCustomStatus = () => {
    const value = statusValue.trim().toLowerCase();
    const label = statusLabel.trim();
    if (!value || !label) return;
    void patchWorkspace({
      custom_statuses: [
        ...workspace.custom_statuses,
        { value, label, active: true },
      ],
    });
    setStatusValue("");
    setStatusLabel("");
  };

  return (
    <TicketSettingsPanelShell
      title="Workflow"
      description="Status rules, tags, auto-close, and CSAT on resolve."
    >
      <IntegrationFeatureSwitchRow
        label="Require internal note on status changes"
        description="Waiting, resolved, and reopening a ticket."
        checked={workspace.require_status_change_note}
        disabled={saving}
        onCheckedChange={(checked) =>
          void patchWorkspace({ require_status_change_note: checked })
        }
      />

      <div className="space-y-2 rounded-xl border bg-muted/10 p-4">
        <Label>Auto-close resolved tickets after (days)</Label>
        <Input
          type="number"
          min={0}
          value={workspace.auto_close_resolved_days ?? ""}
          placeholder="Disabled"
          onChange={(e) => {
            const raw = e.target.value.trim();
            void patchWorkspace({
              auto_close_resolved_days: raw ? Number(raw) : null,
            });
          }}
        />
        <p className="text-[11px] text-muted-foreground">
          Daily cron adds an internal note on stale resolved tickets.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
        <p className="text-sm font-medium">Allowed ticket tags</p>
        <div className="flex gap-2">
          <Input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            placeholder="billing"
          />
          <Button type="button" variant="outline" onClick={addTag}>
            <Plus className="size-4" />
          </Button>
        </div>
        <ul className="space-y-1 text-xs">
          {workspace.allowed_ticket_tags.map((tag) => (
            <li key={tag} className="flex items-center justify-between rounded border px-2 py-1">
              {tag}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  void patchWorkspace({
                    allowed_ticket_tags: workspace.allowed_ticket_tags.filter(
                      (entry) => entry !== tag,
                    ),
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
        <p className="text-sm font-medium">Custom statuses</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value)}
            placeholder="value (slug)"
          />
          <Input
            value={statusLabel}
            onChange={(e) => setStatusLabel(e.target.value)}
            placeholder="Label"
          />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addCustomStatus}>
          Add status
        </Button>
        <ul className="space-y-1 text-xs">
          {workspace.custom_statuses.map((status) => (
            <li key={status.value} className="flex items-center justify-between rounded border px-2 py-1">
              <span>
                {status.label} <span className="text-muted-foreground">({status.value})</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  void patchWorkspace({
                    custom_statuses: workspace.custom_statuses.filter(
                      (entry) => entry.value !== status.value,
                    ),
                  })
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
        <IntegrationFeatureSwitchRow
          label="Send CSAT email when ticket is resolved"
          checked={workspace.csat_enabled}
          disabled={saving}
          onCheckedChange={(checked) =>
            void patchWorkspace({ csat_enabled: checked })
          }
        />
        <div className="space-y-2">
          <Label>CSAT subject</Label>
          <Input
            value={workspace.csat_subject}
            onChange={(e) => void patchWorkspace({ csat_subject: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>CSAT body (HTML)</Label>
          <Textarea
            rows={4}
            value={workspace.csat_body_html}
            onChange={(e) => void patchWorkspace({ csat_body_html: e.target.value })}
          />
        </div>
      </section>
    </TicketSettingsPanelShell>
  );
};
