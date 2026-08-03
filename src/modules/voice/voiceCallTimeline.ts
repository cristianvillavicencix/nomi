import type { ConversationMessage, VoiceCall } from "@/modules/types";
import {
  formatCallDuration,
  voiceCallStatusLabel,
} from "@/modules/voice/voiceCallFormat";

export type ClientConversationTimelineItem =
  | { kind: "message"; at: string; message: ConversationMessage }
  | { kind: "call"; at: string; call: VoiceCall };

export const getVoiceCallTimelineTimestamp = (call: VoiceCall): string =>
  call.ended_at ?? call.started_at ?? call.created_at ?? "";

export const buildVoiceCallTimelineLabel = (call: VoiceCall): string => {
  const status = call.status?.trim().toLowerCase() ?? "";
  const isInbound = call.direction === "inbound";
  const duration = formatCallDuration(call.duration_seconds);
  const hasDuration =
    call.duration_seconds != null && call.duration_seconds > 0;

  if (
    isInbound &&
    (status === "no-answer" || status === "canceled" || status === "busy")
  ) {
    if (status === "busy") return "Missed call · Busy";
    return "Missed call";
  }

  if (!isInbound && status === "no-answer") {
    return "Outgoing call · No answer";
  }
  if (!isInbound && status === "busy") {
    return "Outgoing call · Busy";
  }
  if (status === "failed") {
    return isInbound ? "Incoming call · Failed" : "Outgoing call · Failed";
  }
  if (status === "canceled") {
    return isInbound ? "Missed call" : "Outgoing call · Canceled";
  }

  const prefix = isInbound ? "Incoming call" : "Outgoing call";
  if (hasDuration) return `${prefix} · ${duration}`;
  if (status === "completed") return prefix;
  if (status === "in-progress" || status === "ringing") {
    return `${prefix} · ${voiceCallStatusLabel(status)}`;
  }
  return `${prefix} · ${voiceCallStatusLabel(status)}`;
};

export const mergeClientConversationTimeline = (
  messages: ConversationMessage[],
  calls: VoiceCall[],
): ClientConversationTimelineItem[] => {
  const items: ClientConversationTimelineItem[] = [
    ...messages.map((message) => ({
      kind: "message" as const,
      at: message.created_at ?? "",
      message,
    })),
    ...calls
      .map((call) => ({
        kind: "call" as const,
        at: getVoiceCallTimelineTimestamp(call),
        call,
      }))
      .filter((entry) => entry.at),
  ];

  return items.sort((left, right) => {
    const diff = left.at.localeCompare(right.at);
    if (diff !== 0) return diff;
    if (left.kind === right.kind) return 0;
    return left.kind === "message" ? -1 : 1;
  });
};
