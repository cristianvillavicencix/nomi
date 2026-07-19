export type MeetingNotificationSettings = {
  host_confirmation_on_create: boolean;
  client_invite_email_default: boolean;
  client_invite_sms_default: boolean;
  remind_host_at_15: boolean;
  remind_host_at_5: boolean;
  remind_client_at_15: boolean;
  remind_client_at_5: boolean;
  include_add_to_calendar_link: boolean;
};

export const DEFAULT_MEETING_NOTIFICATION_SETTINGS: MeetingNotificationSettings =
  {
    host_confirmation_on_create: true,
    client_invite_email_default: true,
    client_invite_sms_default: true,
    remind_host_at_15: true,
    remind_host_at_5: true,
    remind_client_at_15: true,
    remind_client_at_5: true,
    include_add_to_calendar_link: true,
  };

const readBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export const normalizeMeetingNotificationSettings = (
  raw: unknown,
): MeetingNotificationSettings => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_MEETING_NOTIFICATION_SETTINGS };
  }

  const record = raw as Record<string, unknown>;
  return {
    host_confirmation_on_create: readBoolean(
      record.host_confirmation_on_create,
      DEFAULT_MEETING_NOTIFICATION_SETTINGS.host_confirmation_on_create,
    ),
    client_invite_email_default: readBoolean(
      record.client_invite_email_default,
      DEFAULT_MEETING_NOTIFICATION_SETTINGS.client_invite_email_default,
    ),
    client_invite_sms_default: readBoolean(
      record.client_invite_sms_default,
      DEFAULT_MEETING_NOTIFICATION_SETTINGS.client_invite_sms_default,
    ),
    remind_host_at_15: readBoolean(
      record.remind_host_at_15,
      DEFAULT_MEETING_NOTIFICATION_SETTINGS.remind_host_at_15,
    ),
    remind_host_at_5: readBoolean(
      record.remind_host_at_5,
      DEFAULT_MEETING_NOTIFICATION_SETTINGS.remind_host_at_5,
    ),
    remind_client_at_15: readBoolean(
      record.remind_client_at_15,
      DEFAULT_MEETING_NOTIFICATION_SETTINGS.remind_client_at_15,
    ),
    remind_client_at_5: readBoolean(
      record.remind_client_at_5,
      DEFAULT_MEETING_NOTIFICATION_SETTINGS.remind_client_at_5,
    ),
    include_add_to_calendar_link: readBoolean(
      record.include_add_to_calendar_link,
      DEFAULT_MEETING_NOTIFICATION_SETTINGS.include_add_to_calendar_link,
    ),
  };
};
