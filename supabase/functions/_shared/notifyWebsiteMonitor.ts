import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";
import { sendTwilioSms } from "./twilio.ts";
import { getWebsiteMonitorSettings } from "./websiteMonitorSettings.ts";
import type { WebsiteCheckResult, WebsiteMonitorSiteRow } from "./websiteMonitor.ts";

const toE164 = (phone: string): string | null => {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+") && /^\+[1-9]\d{1,14}$/.test(trimmed)) {
    return trimmed;
  }
  return normalizeUsPhoneToE164(trimmed);
};

const resolveMemberPhone = async (
  supabase: SupabaseClient,
  memberId: number,
): Promise<string | null> => {
  const { data: member } = await supabase
    .from("organization_members")
    .select("notification_phone, user_id")
    .eq("id", memberId)
    .maybeSingle();

  if (member?.notification_phone) {
    return toE164(member.notification_phone);
  }
  if (!member?.user_id) return null;

  const { data: authData } = await supabase.auth.admin.getUserById(
    member.user_id,
  );
  const authPhone = authData?.user?.phone?.trim();
  if (authPhone) return toE164(authPhone);
  return null;
};

const shouldAlert = (
  site: WebsiteMonitorSiteRow,
  result: WebsiteCheckResult,
): string | null => {
  const previousStatus = site.last_status ?? "unknown";

  if (
    result.status === "down" &&
    site.alert_on_down !== false &&
    previousStatus !== "down"
  ) {
    return "down";
  }
  if (
    result.status === "slow" &&
    site.alert_on_slow &&
    previousStatus !== "slow" &&
    previousStatus !== "down"
  ) {
    return "slow";
  }
  if (
    site.alert_on_ssl !== false &&
    result.sslDaysRemaining != null &&
    result.sslDaysRemaining <= 14 &&
    (site.ssl_days_remaining == null || site.ssl_days_remaining > 14)
  ) {
    return "ssl_expiring";
  }
  return null;
};

export const notifyWebsiteMonitorAlert = async (
  supabase: SupabaseClient,
  site: WebsiteMonitorSiteRow,
  result: WebsiteCheckResult,
  options?: { appBaseUrl?: string | null },
): Promise<{ sent: boolean; reason?: string }> => {
  const alertKind = shouldAlert(site, result);
  if (!alertKind) {
    return { sent: false, reason: "no_alert_needed" };
  }

  const orgSettings = await getWebsiteMonitorSettings(supabase, site.org_id);
  if (!orgSettings.enabled || !orgSettings.sms_alerts_enabled) {
    return { sent: false, reason: "org_alerts_disabled" };
  }

  const lastAlertAt = site.last_alert_sent_at
    ? new Date(site.last_alert_sent_at).getTime()
    : 0;
  const cooldownMs = orgSettings.alert_cooldown_hours * 60 * 60 * 1000;
  if (lastAlertAt && Date.now() - lastAlertAt < cooldownMs) {
    return { sent: false, reason: "cooldown" };
  }

  const settings = await getMessagingSettingsSecrets(site.org_id);
  if (
    !settings?.twilio_account_sid ||
    !settings.twilio_auth_token ||
    !settings.twilio_phone_number
  ) {
    return { sent: false, reason: "no_messaging_settings" };
  }

  const { data: members } = await supabase
    .from("organization_members")
    .select("id, administrator")
    .eq("org_id", site.org_id);

  const recipients = (members ?? []).filter(
    (member) => member.administrator === true,
  );
  if (!recipients.length) {
    return { sent: false, reason: "no_recipients" };
  }

  const label = site.display_name ?? site.url;
  const baseUrl = (options?.appBaseUrl ?? Deno.env.get("APP_BASE_URL") ?? "")
    .replace(/\/$/, "");
  const monitorLink = baseUrl
    ? `${baseUrl}/web-monitor/${site.id}/show`
    : "";

  let message = "";
  if (alertKind === "down") {
    message = `[Web Monitor] ${label} is DOWN. ${site.url}`;
  } else if (alertKind === "slow") {
    message = `[Web Monitor] ${label} is SLOW (${result.responseMs}ms). ${site.url}`;
  } else {
    message = `[Web Monitor] SSL for ${label} expires in ${result.sslDaysRemaining} days.`;
  }
  if (monitorLink) message += ` ${monitorLink}`;

  let sentCount = 0;
  for (const member of recipients) {
    const phone = await resolveMemberPhone(supabase, member.id);
    if (!phone) continue;
    try {
      await sendTwilioSms({
        accountSid: settings.twilio_account_sid,
        authToken: settings.twilio_auth_token,
        from: settings.twilio_phone_number,
        to: phone,
        body: message.slice(0, 1500),
      });
      sentCount += 1;
    } catch {
      // continue to next recipient
    }
  }

  if (sentCount > 0) {
    await supabase
      .from("monitored_websites")
      .update({
        last_alert_sent_at: new Date().toISOString(),
        last_alert_status: alertKind,
      })
      .eq("id", site.id);
    return { sent: true };
  }

  return { sent: false, reason: "send_failed" };
};
