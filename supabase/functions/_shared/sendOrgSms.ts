import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import { sendTelnyxSms } from "./telnyx.ts";
import { sendTwilioSms } from "./twilio.ts";

export type SendOrgSmsResult = {
  sid?: string;
  id?: string;
  status?: string;
  provider: "twilio" | "telnyx";
};

/** Provider-aware SMS send for an organization. */
export async function sendOrgSms(params: {
  orgId: number;
  to: string;
  body: string;
  mediaUrls?: string[];
  /** Twilio Messaging Service SID override (marketing). Ignored for Telnyx. */
  messagingServiceSid?: string | null;
  /** From override; defaults to org phone for the active provider. */
  from?: string | null;
}): Promise<SendOrgSmsResult> {
  const settings = await getMessagingSettingsSecrets(params.orgId);
  if (!settings?.sms_enabled) {
    throw new Error("SMS is not enabled for this organization");
  }

  const provider = settings.messaging_provider === "telnyx" ? "telnyx" : "twilio";

  if (provider === "telnyx") {
    const apiKey = settings.telnyx_api_key?.trim();
    const from =
      params.from?.trim() ||
      settings.telnyx_phone_number?.trim() ||
      null;
    if (!apiKey && !from) {
      throw new Error(
        "Telnyx API key and phone number are required. Configure them in Settings → Connectors.",
      );
    }
    if (!apiKey) {
      throw new Error(
        "Telnyx API key is missing or could not be decrypted. Re-save the API key in Settings → Connectors.",
      );
    }
    if (!from) {
      throw new Error(
        "Telnyx phone number is required. Configure it in Settings → Connectors.",
      );
    }
    const result = await sendTelnyxSms({
      apiKey,
      from,
      to: params.to,
      body: params.body,
      mediaUrls: params.mediaUrls,
      messagingProfileId: settings.telnyx_messaging_profile_id,
    });
    return {
      id: result.id,
      sid: result.id,
      status: result.status,
      provider: "telnyx",
    };
  }

  const accountSid = settings.twilio_account_sid?.trim();
  const authToken = settings.twilio_auth_token?.trim();
  const from =
    params.from?.trim() ||
    settings.twilio_phone_number?.trim() ||
    null;
  const messagingServiceSid = params.messagingServiceSid?.trim() || null;
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are not configured");
  }
  if (!messagingServiceSid && !from) {
    throw new Error("Twilio sender (From or Messaging Service) is required");
  }

  const result = await sendTwilioSms({
    accountSid,
    authToken,
    from: from ?? undefined,
    messagingServiceSid,
    to: params.to,
    body: params.body,
    mediaUrls: params.mediaUrls,
  });

  return {
    sid: result.sid,
    id: result.sid,
    status: result.status,
    provider: "twilio",
  };
}
