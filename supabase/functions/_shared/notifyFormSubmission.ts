import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";
import { sendTwilioSms } from "./twilio.ts";

type FormInstance = {
  id: number;
  org_id: number;
  name: string;
  notify_on_submit?: boolean | null;
  notify_member_ids?: number[] | null;
};

type Submission = {
  id: number;
  submitter_name?: string | null;
};

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

  const { data: authData, error } = await supabase.auth.admin.getUserById(
    member.user_id,
  );
  if (error || !authData?.user) return null;

  const authPhone = authData.user.phone?.trim();
  if (authPhone) {
    return toE164(authPhone);
  }

  const metaPhone =
    typeof authData.user.user_metadata?.phone === "string"
      ? authData.user.user_metadata.phone.trim()
      : "";
  if (metaPhone) {
    return toE164(metaPhone);
  }

  return null;
};

const resolveAppBaseUrl = (fallback?: string | null) => {
  const envUrl =
    Deno.env.get("PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("VITE_PUBLIC_APP_URL")?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (fallback?.trim()) return fallback.replace(/\/$/, "");
  return "";
};

export async function notifyTeamOnSubmit(
  supabase: SupabaseClient,
  instance: FormInstance,
  submission: Submission,
  options?: { appBaseUrl?: string | null },
) {
  if (!instance.notify_on_submit) return;

  const memberIds = (instance.notify_member_ids ?? []).filter((id) =>
    Number.isFinite(id),
  );
  if (memberIds.length === 0) return;

  let settings;
  try {
    settings = await getMessagingSettingsSecrets(instance.org_id);
  } catch (error) {
    console.error("[notifyFormSubmission] settings error", error);
    return;
  }

  const accountSid = settings.twilio_account_sid?.trim();
  const authToken = settings.twilio_auth_token?.trim();
  const fromNumber = settings.twilio_phone_number?.trim();

  if (!settings.sms_enabled || !accountSid || !authToken || !fromNumber) {
    console.warn("[notifyFormSubmission] SMS not configured for org", {
      orgId: instance.org_id,
    });
    return;
  }

  const baseUrl = resolveAppBaseUrl(options?.appBaseUrl);
  const submissionPath = baseUrl
    ? `${baseUrl}/forms-v2/submissions/${submission.id}`
    : `submission #${submission.id}`;
  const submitter = submission.submitter_name?.trim() || "Someone";
  const body =
    `New ${instance.name}: ${submitter}. View: ${submissionPath}`.slice(
      0,
      1600,
    );

  for (const memberId of memberIds) {
    const to = await resolveMemberPhone(supabase, memberId);
    if (!to) {
      console.warn("[notifyFormSubmission] Member has no phone configured", {
        member_id: memberId,
        form_id: instance.id,
      });
      continue;
    }

    try {
      await sendTwilioSms({
        accountSid,
        authToken,
        from: fromNumber,
        to,
        body,
      });
    } catch (error) {
      console.error("[notifyFormSubmission] Twilio error", {
        memberId,
        error,
      });
    }
  }
}
