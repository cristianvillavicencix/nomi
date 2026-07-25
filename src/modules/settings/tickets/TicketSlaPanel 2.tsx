import { Link } from "react-router";
import { useDataProvider } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { TicketSettingsPanelShell } from "@/modules/settings/tickets/TicketSettingsPanelShell";
import { useTicketWorkspaceSettingsContext } from "@/modules/settings/tickets/useTicketWorkspaceSettings";
import {
  BUSINESS_HOURS_SETTINGS_PATH,
  formatBusinessHoursSummary,
  hasConfiguredBusinessHours,
} from "@/modules/shared/organizationBusinessHours";

export const TicketSlaPanel = ({ embedded }: { embedded?: boolean }) => {
  const { data, patchWorkspace, saving } = useTicketWorkspaceSettingsContext();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data: messagingSettings } = useQuery({
    queryKey: ["messaging-settings", "business-hours"],
    queryFn: () => dataProvider.getMessagingSettings(),
    staleTime: 60_000,
  });
  const workspace = data?.workspace;
  if (!workspace) return null;

  const communicationsHours = messagingSettings?.business_hours;
  const usesCommunications = hasConfiguredBusinessHours(communicationsHours);
  const hoursSummary = formatBusinessHoursSummary(communicationsHours);

  const body = (
    <>
      <div className="space-y-2 rounded-xl border bg-muted/10 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Business hours</p>
          <p className="text-xs text-muted-foreground">
            Shared with Calendar, SMS auto-replies, and SLA reporting. Edit in
            Communications settings.
          </p>
        </div>
        {usesCommunications && hoursSummary ? (
          <p className="text-xs text-foreground">{hoursSummary}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            No business hours configured yet.
          </p>
        )}
        <Link
          to={BUSINESS_HOURS_SETTINGS_PATH}
          className="inline-flex text-xs font-medium text-primary hover:underline"
        >
          Open Settings → Connectors → Twilio → Business hours
        </Link>
      </div>

      {!usesCommunications && workspace.business_hours_enabled ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Legacy ticket business hours are still active. Save the shared schedule
          in{" "}
          <Link
            to={BUSINESS_HOURS_SETTINGS_PATH}
            className="font-medium text-primary hover:underline"
          >
            Connectors → Twilio → Business hours
          </Link>{" "}
          to migrate and disable this fallback.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label>Timezone</Label>
        <Input
          value={workspace.business_hours_timezone}
          onChange={(e) =>
            void patchWorkspace({ business_hours_timezone: e.target.value })
          }
        />
        <p className="text-xs text-muted-foreground">
          Used for SLA reporting. Calendar slots follow Communications hours in
          your browser timezone unless a dedicated org timezone is added later.
        </p>
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
            SLA targets and shared business hours reference.
          </p>
        </div>
        <div className="space-y-4">{body}</div>
      </section>
    );
  }

  return (
    <TicketSettingsPanelShell
      title="SLA & business hours"
      description="SLA targets and shared business hours reference."
    >
      {body}
    </TicketSettingsPanelShell>
  );
};
