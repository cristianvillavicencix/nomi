import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";
import { TicketSettingsPanelShell } from "@/modules/settings/tickets/TicketSettingsPanelShell";
import { useTicketWorkspaceSettingsContext } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const TicketSlaPanel = ({ embedded }: { embedded?: boolean }) => {
  const { data, patchWorkspace, saving } = useTicketWorkspaceSettingsContext();
  const workspace = data?.workspace;
  if (!workspace) return null;

  const body = (
    <>
      <IntegrationFeatureSwitchRow
        label="Enable business hours"
        description="Used for SLA reporting and future out-of-hours auto-replies."
        checked={workspace.business_hours_enabled}
        disabled={saving}
        onCheckedChange={(checked) =>
          void patchWorkspace({ business_hours_enabled: checked })
        }
      />

      <div className="space-y-2">
        <Label>Timezone</Label>
        <Input
          value={workspace.business_hours_timezone}
          onChange={(e) =>
            void patchWorkspace({ business_hours_timezone: e.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <Label>First response SLA (hours)</Label>
        <Input
          type="number"
          min={0}
          value={workspace.sla_first_response_hours ?? ""}
          placeholder="Disabled"
          onChange={(e) => {
            const raw = e.target.value.trim();
            void patchWorkspace({
              sla_first_response_hours: raw ? Number(raw) : null,
            });
          }}
        />
      </div>

      <div className="space-y-2 rounded-xl border p-3">
        <p className="text-sm font-medium">Weekly schedule</p>
        {DAYS.map((day) => {
          const row = workspace.business_hours[day] ?? {
            enabled: false,
            start: "09:00",
            end: "17:00",
          };
          return (
            <div key={day} className="grid grid-cols-[72px_1fr_1fr_auto] items-center gap-2 text-xs">
              <span className="uppercase text-muted-foreground">{day}</span>
              <Input
                type="time"
                value={row.start}
                disabled={!row.enabled}
                onChange={(e) =>
                  void patchWorkspace({
                    business_hours: {
                      ...workspace.business_hours,
                      [day]: { ...row, start: e.target.value },
                    },
                  })
                }
              />
              <Input
                type="time"
                value={row.end}
                disabled={!row.enabled}
                onChange={(e) =>
                  void patchWorkspace({
                    business_hours: {
                      ...workspace.business_hours,
                      [day]: { ...row, end: e.target.value },
                    },
                  })
                }
              />
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) =>
                    void patchWorkspace({
                      business_hours: {
                        ...workspace.business_hours,
                        [day]: { ...row, enabled: e.target.checked },
                      },
                    })
                  }
                />
                On
              </label>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 rounded-xl border bg-muted/10 p-4">
        <Label>Max email-embedded attachment size (MB)</Label>
        <Input
          type="number"
          min={1}
          max={25}
          value={Math.round(workspace.max_reply_attachment_bytes / (1024 * 1024))}
          onChange={(e) => {
            const mb = Number(e.target.value);
            if (!Number.isFinite(mb) || mb <= 0) return;
            void patchWorkspace({
              max_reply_attachment_bytes: mb * 1024 * 1024,
            });
          }}
        />
        <p className="text-xs text-muted-foreground">
          Files up to this size are attached to the email. Larger files (up to
          25 MB) are uploaded and sent as download links that expire in 7 days.
        </p>
      </div>
    </>
  );

  if (embedded) {
    return (
      <section className="space-y-4 rounded-xl border bg-muted/10 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">SLA & business hours</p>
          <p className="text-xs text-muted-foreground">
            Business hours and first-response SLA target.
          </p>
        </div>
        <div className="space-y-4">{body}</div>
      </section>
    );
  }

  return (
    <TicketSettingsPanelShell
      title="SLA & business hours"
      description="Business hours reference and first-response SLA target."
    >
      {body}
    </TicketSettingsPanelShell>
  );
};
