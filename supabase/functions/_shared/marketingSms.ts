import { supabaseAdmin } from "./supabaseAdmin.ts";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import { sendOrgSms } from "./sendOrgSms.ts";
import { appendSmsStopFooter } from "./marketingOptOut.ts";
import { loadSmsSuppressions } from "./marketingAudience.ts";

export type MarketingOrgSettings = {
  messagingServiceSid: string | null;
  fromNumber: string | null;
};

export async function getMarketingOrgSmsSettings(
  orgId: number,
): Promise<MarketingOrgSettings> {
  const secrets = await getMessagingSettingsSecrets(orgId);
  if (!secrets?.sms_enabled) {
    throw new Error("SMS is not enabled for this organization");
  }

  if (secrets.messaging_provider === "telnyx") {
    const fromNumber = secrets.telnyx_phone_number?.trim() || null;
    if (!secrets.telnyx_api_key?.trim() || !fromNumber) {
      throw new Error(
        "Telnyx API key and phone number are required for marketing SMS",
      );
    }
    return { messagingServiceSid: null, fromNumber };
  }

  if (!secrets.twilio_account_sid?.trim() || !secrets.twilio_auth_token?.trim()) {
    throw new Error("Twilio credentials are not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("organization_messaging_settings")
    .select(
      "twilio_marketing_messaging_service_sid, twilio_marketing_phone_number, twilio_phone_number",
    )
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load marketing SMS settings");
  }

  const messagingServiceSid =
    data?.twilio_marketing_messaging_service_sid?.trim() || null;
  const fromNumber =
    data?.twilio_marketing_phone_number?.trim() ||
    data?.twilio_phone_number?.trim() ||
    secrets.twilio_phone_number?.trim() ||
    null;

  if (!messagingServiceSid && !fromNumber) {
    throw new Error(
      "Marketing SMS sender is not configured. Add a Messaging Service SID or marketing phone number in Settings.",
    );
  }

  return { messagingServiceSid, fromNumber };
}

export async function sendMarketingSms(params: {
  orgId: number;
  to: string;
  body: string;
  includeStopFooter?: boolean;
}) {
  const settings = await getMarketingOrgSmsSettings(params.orgId);
  const suppressed = await loadSmsSuppressions(params.orgId, [params.to]);
  if (suppressed.has(params.to)) {
    throw new Error("Recipient has opted out of marketing SMS");
  }

  const body =
    params.includeStopFooter === false
      ? params.body.trim()
      : appendSmsStopFooter(params.body);

  return sendOrgSms({
    orgId: params.orgId,
    to: params.to,
    body,
    messagingServiceSid: settings.messagingServiceSid,
    from: settings.messagingServiceSid ? null : settings.fromNumber,
  });
}
