import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";
import { sendTwilioSms } from "./twilio.ts";
import { getWebsiteMonitorSettings } from "./websiteMonitorSettings.ts";

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

export type WebsiteAuditScoreDropSite = {
  id: number;
  org_id: number;
  url: string;
  display_name?: string | null;
  audit_alert_on_score_drop?: boolean | null;
  audit_score_drop_threshold?: number | null;
  last_audit_score_alert_at?: string | null;
};

export const notifyWebsiteAuditScoreDrop = async (
  supabase: SupabaseClient,
  site: WebsiteAuditScoreDropSite,
  currentScore: number,
  previousScore: number,
  options?: { appBaseUrl?: string | null },
): Promise<{ sent: boolean; reason?: string }> => {
  if (site.audit_alert_on_score_drop === false) {
    return { sent: false, reason: "site_alerts_disabled" };
  }

  const drop = previousScore - currentScore;
  const threshold = site.audit_score_drop_threshold ?? 10;
  if (drop < threshold) {
    return { sent: false, reason: "below_threshold" };
  }

  const orgSettings = await getWebsiteMonitorSettings(supabase, site.org_id);
  if (!orgSettings.enabled || !orgSettings.sms_alerts_enabled) {
    return { sent: false, reason: "org_alerts_disabled" };
  }

  const lastAlertAt = site.last_audit_score_alert_at
    ? new Date(site.last_audit_score_alert_at).getTime()
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
  const reportLink = baseUrl
    ? `${baseUrl}/web-monitor/${site.id}/show?tab=report`
    : "";

  let message =
    `[Web Report] ${label} score dropped ${drop} pts (${previousScore} → ${currentScore}). ${site.url}`;
  if (reportLink) message += ` ${reportLink}`;

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
      .update({ last_audit_score_alert_at: new Date().toISOString() })
      .eq("id", site.id);
    return { sent: true };
  }

  return { sent: false, reason: "send_failed" };
};
