import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import {
  normalizeMeetingNotificationSettings,
  type MeetingNotificationSettings,
} from "@/modules/meetings/meetingNotificationSettings";

export type OrganizationMeetingNotificationSettingsRow =
  MeetingNotificationSettings & {
    id: number;
    name?: string | null;
  };

export const useOrganizationMeetingNotificationSettings = (enabled = true) =>
  useQuery({
    queryKey: ["organization-meeting-notification-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, meeting_notification_settings")
        .single();

      if (error) throw error;

      const row = data as {
        id: number;
        name?: string | null;
        meeting_notification_settings?: unknown;
      };

      return {
        id: row.id,
        name: row.name,
        ...normalizeMeetingNotificationSettings(
          row.meeting_notification_settings,
        ),
      } satisfies OrganizationMeetingNotificationSettingsRow;
    },
    enabled,
  });
