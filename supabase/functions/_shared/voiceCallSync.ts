import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { mapTwilioVoiceStatus } from "./twilioVoice.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";

const parseOptionalId = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const upsertVoiceCallFromTwilioStatus = async (
  client: SupabaseClient,
  params: Record<string, string>,
  orgId: number,
) => {
  const callSid = params.CallSid?.trim();
  if (!callSid) return;

  const parentSid = params.ParentCallSid?.trim();
  const externalId = parentSid || callSid;
  const status = mapTwilioVoiceStatus(params.CallStatus ?? "queued");
  const direction =
    (params.Direction ?? "").toLowerCase() === "inbound"
      ? "inbound"
      : "outbound";

  const fromNumber =
    normalizeUsPhoneToE164(params.From ?? "") ?? params.From?.trim() ?? null;
  const toNumber =
    normalizeUsPhoneToE164(params.To ?? "") ?? params.To?.trim() ?? null;

  const durationSeconds = Number(params.CallDuration);
  const memberId = parseOptionalId(params.member_id);
  const contactId = parseOptionalId(params.contact_id);
  const dealId = parseOptionalId(params.deal_id);
  const conversationId = parseOptionalId(params.conversation_id);

  const now = new Date().toISOString();
  const terminal = ["completed", "failed", "busy", "no-answer", "canceled"].includes(
    status,
  );

  const { data: existing } = await client
    .from("voice_calls")
    .select("id, started_at")
    .eq("org_id", orgId)
    .eq("external_id", externalId)
    .maybeSingle();

  const payload = {
    org_id: orgId,
    external_id: externalId,
    direction,
    status,
    from_number: fromNumber,
    to_number: toNumber,
    member_id: memberId,
    contact_id: contactId,
    deal_id: dealId,
    conversation_id: conversationId,
    duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    started_at:
      existing?.started_at ??
      (status === "in-progress" || status === "ringing" ? now : null),
    ended_at: terminal ? now : null,
  };

  if (existing?.id) {
    await client.from("voice_calls").update(payload).eq("id", existing.id);
    return;
  }

  await client.from("voice_calls").insert({
    ...payload,
    started_at: payload.started_at ?? now,
  });
};
