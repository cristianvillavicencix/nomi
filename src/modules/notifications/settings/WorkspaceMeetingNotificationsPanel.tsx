import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Link } from "react-router";
import { useNotify } from "ra-core";
import { useEffect, useState } from "react";

import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_MEETING_NOTIFICATION_SETTINGS,
  type MeetingNotificationSettings,
} from "@/modules/meetings/meetingNotificationSettings";
import { NotificationSettingsRow } from "@/modules/notifications/settings/NotificationSettingsRow";
import {
  SettingsRows,
  SettingsSection,
} from "@/modules/settings/SettingsSection";
import { useOrganizationMeetingNotificationSettings } from "@/modules/settings/useOrganizationMeetingNotificationSettings";

const TOGGLE_ROWS: Array<{
  key: keyof MeetingNotificationSettings;
  label: string;
  hint?: string;
}> = [
  {
    key: "host_confirmation_on_create",
    label: "SMS host when a meeting is scheduled",
    hint: "Uses the host’s notification phone from Settings → Notifications → Personal.",
  },
  {
    key: "client_invite_email_default",
    label: "Default: email invite to client",
  },
  {
    key: "client_invite_sms_default",
    label: "Default: SMS invite to client",
  },
  {
    key: "remind_host_at_15",
    label: "Remind host 15 minutes before",
  },
  {
    key: "remind_host_at_5",
    label: "Remind host 5 minutes before",
  },
  {
    key: "remind_client_at_15",
    label: "Remind client 15 minutes before",
  },
  {
    key: "remind_client_at_5",
    label: "Remind client 5 minutes before",
  },
  {
    key: "include_add_to_calendar_link",
    label: "Include Add to calendar short link",
    hint: "Appends a short link so host and client can save the event.",
  },
];

export const WorkspaceMeetingNotificationsPanel = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const canManage = useMemberCapability("admin.settings.manage");
  const { data: orgSettings, isPending } =
    useOrganizationMeetingNotificationSettings(canManage);

  const [draft, setDraft] = useState<MeetingNotificationSettings>(
    DEFAULT_MEETING_NOTIFICATION_SETTINGS,
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!orgSettings) return;
    setDraft({
      host_confirmation_on_create: orgSettings.host_confirmation_on_create,
      client_invite_email_default: orgSettings.client_invite_email_default,
      client_invite_sms_default: orgSettings.client_invite_sms_default,
      remind_host_at_15: orgSettings.remind_host_at_15,
      remind_host_at_5: orgSettings.remind_host_at_5,
      remind_client_at_15: orgSettings.remind_client_at_15,
      remind_client_at_5: orgSettings.remind_client_at_5,
      include_add_to_calendar_link: orgSettings.include_add_to_calendar_link,
    });
  }, [orgSettings]);

  const saveMutation = useMutation({
    mutationFn: async (next: MeetingNotificationSettings) => {
      if (orgSettings?.id == null) {
        throw new Error("Organization not loaded");
      }
      const { data, error } = await supabase
        .from("organizations")
        .update({ meeting_notification_settings: next })
        .eq("id", orgSettings.id)
        .select("id, name, meeting_notification_settings")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(
        ["organization-meeting-notification-settings"],
        {
          id: (saved as { id: number }).id,
          name: (saved as { name?: string | null }).name,
          ...draft,
        },
      );
      notify("Meeting notification settings updated", { type: "success" });
    },
    onError: (error) => {
      notify(
        error instanceof Error
          ? error.message
          : "Failed to save meeting notifications",
        { type: "error" },
      );
    },
    onSettled: () => setSavingKey(null),
  });

  if (!canManage) {
    return (
      <SettingsSection title="Meetings & video calls">
        <p className="text-sm text-muted-foreground">
          Only workspace admins can change meeting notification defaults.
        </p>
      </SettingsSection>
    );
  }

  if (isPending || !orgSettings) {
    return (
      <SettingsSection title="Meetings & video calls">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      </SettingsSection>
    );
  }

  const toggle = (key: keyof MeetingNotificationSettings, value: boolean) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    setSavingKey(key);
    saveMutation.mutate(next);
  };

  return (
    <SettingsSection title="Meetings & video calls">
      <p className="mb-4 text-sm text-muted-foreground">
        Defaults for scheduled video calls: invites, host confirmation, and
        reminders.
      </p>
      <SettingsRows>
        {TOGGLE_ROWS.map((row) => (
          <NotificationSettingsRow
            key={row.key}
            label={row.label}
            hint={row.hint}
            control={
              <div className="flex items-center gap-2">
                {savingKey === row.key && saveMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                ) : null}
                <Switch
                  checked={draft[row.key]}
                  disabled={saveMutation.isPending}
                  onCheckedChange={(checked) => toggle(row.key, checked)}
                />
              </div>
            }
          />
        ))}
      </SettingsRows>
      <p className="mt-4 text-xs text-muted-foreground">
        Host SMS needs a phone under{" "}
        <Link
          to="/settings?tab=notifications&section=personal"
          className="underline underline-offset-2"
        >
          Notifications → Personal
        </Link>
        . Twilio must be connected under Connectors.
      </p>
    </SettingsSection>
  );
};
