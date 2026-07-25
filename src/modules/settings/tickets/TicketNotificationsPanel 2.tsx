import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";
import { TicketSettingsPanelShell } from "@/modules/settings/tickets/TicketSettingsPanelShell";
import { useTicketWorkspaceSettingsContext } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

export const TicketNotificationsPanel = ({ embedded }: { embedded?: boolean }) => {
  const { data, patchWorkspace, saving } = useTicketWorkspaceSettingsContext();
  const workspace = data?.workspace;
  if (!workspace) return null;

  const body = (
    <>
      <div className="space-y-2">
          <Label>Who gets alerted for inbound client mail</Label>
          <RadioGroup
            value={workspace.notification_audience}
            onValueChange={(value) =>
              void patchWorkspace({
                notification_audience: value as "assignee" | "team",
              })
            }
            className="grid gap-2"
            disabled={saving}
          >
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <RadioGroupItem value="assignee" />
              Assignee only
            </label>
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <RadioGroupItem value="team" />
              Everyone with ticket access
            </label>
          </RadioGroup>
        </div>
        <IntegrationFeatureSwitchRow
          label="Play sound (workspace default)"
          checked={workspace.workspace_notify_sound}
          disabled={saving}
          onCheckedChange={(checked) =>
            void patchWorkspace({ workspace_notify_sound: checked })
          }
        />
        <IntegrationFeatureSwitchRow
          label="Desktop notifications when tab hidden"
          checked={workspace.workspace_notify_desktop}
          disabled={saving}
          onCheckedChange={(checked) =>
            void patchWorkspace({ workspace_notify_desktop: checked })
          }
        />
    </>
  );

  if (embedded) {
    return (
      <section className="space-y-4 rounded-xl border bg-muted/10 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Notifications</p>
          <p className="text-xs text-muted-foreground">
            Workspace defaults for ticket alerts.
          </p>
        </div>
        <div className="space-y-4">{body}</div>
      </section>
    );
  }

  return (
    <TicketSettingsPanelShell
      title="Notifications"
      description="Workspace defaults for ticket alerts. Personal overrides stay under Settings → Notifications."
    >
      <section className="space-y-4 rounded-xl border bg-muted/10 p-4">{body}</section>
    </TicketSettingsPanelShell>
  );
};
