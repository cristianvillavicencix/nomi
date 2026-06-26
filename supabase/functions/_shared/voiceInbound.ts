import { supabaseAdmin } from "./supabaseAdmin.ts";
import { phonesMatch } from "./phone.ts";
import { hasMemberCapability } from "./memberModulePermissions.ts";
import { buildVoiceClientIdentity } from "./voiceIdentity.ts";
import {
  getVoiceSettingsSecrets,
  type VoiceSettingsSecrets,
} from "./voiceSettings.ts";

const VOICE_RECEIVE_CAPABILITY = "voice.calls.make";

const memberCanReceiveInboundVoice = (member: {
  administrator?: boolean | null;
  module_permissions?: unknown;
}) => {
  if (member.administrator === true) return true;
  const stored =
    member.module_permissions != null &&
    typeof member.module_permissions === "object" &&
    !Array.isArray(member.module_permissions)
      ? (member.module_permissions as Record<string, unknown>)
      : null;
  if (stored?.[VOICE_RECEIVE_CAPABILITY] === true) return true;
  return hasMemberCapability(member, VOICE_RECEIVE_CAPABILITY);
};

export const findOrgVoiceSettingsByInboundNumber = async (
  calledNumber: string,
): Promise<VoiceSettingsSecrets | null> => {
  const trimmed = calledNumber.trim();
  if (!trimmed) return null;

  const { data, error } = await supabaseAdmin
    .from("organization_messaging_settings")
    .select("org_id, twilio_phone_number, voice_caller_id, voice_enabled")
    .eq("voice_enabled", true);

  if (error) {
    throw new Error(error.message ?? "Failed to resolve inbound voice settings");
  }

  const row = (data ?? []).find((entry) => {
    const smsNumber =
      typeof entry.twilio_phone_number === "string"
        ? entry.twilio_phone_number
        : "";
    const callerId =
      typeof entry.voice_caller_id === "string" ? entry.voice_caller_id : "";
    return (
      phonesMatch(smsNumber, trimmed) ||
      phonesMatch(callerId, trimmed) ||
      smsNumber.trim() === trimmed ||
      callerId.trim() === trimmed
    );
  });

  if (!row?.org_id) return null;
  return getVoiceSettingsSecrets(Number(row.org_id));
};

export const listInboundVoiceClientIdentities = async (orgId: number) => {
  const { data, error } = await supabaseAdmin
    .from("organization_members")
    .select("id, administrator, module_permissions")
    .eq("org_id", orgId);

  if (error) {
    throw new Error(error.message ?? "Failed to load voice members");
  }

  return (data ?? [])
    .filter((member) => memberCanReceiveInboundVoice(member))
    .map((member) => buildVoiceClientIdentity(orgId, Number(member.id)))
    .filter((identity) => identity.length > 0)
    .slice(0, 10);
};
