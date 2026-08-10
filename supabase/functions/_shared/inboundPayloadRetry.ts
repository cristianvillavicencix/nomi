import type { PostmarkInboundPayload } from "../postmark/processTicketInbound.ts";

export const serializeInboundPayloadForRetry = (
  payload: PostmarkInboundPayload,
): Record<string, unknown> => ({
  MessageID: payload.MessageID ?? null,
  Subject: payload.Subject ?? null,
  TextBody: payload.TextBody ?? null,
  HtmlBody: payload.HtmlBody ?? null,
  FromFull: payload.FromFull ?? null,
  ToFull: payload.ToFull ?? null,
  CcFull: payload.CcFull ?? null,
  Headers: payload.Headers ?? null,
  OriginalRecipient: payload.OriginalRecipient ?? null,
  StrippedTextReply: payload.StrippedTextReply ?? null,
  StrippedHtmlReply: payload.StrippedHtmlReply ?? null,
});

export const deserializeInboundPayloadForRetry = (
  raw: unknown,
): PostmarkInboundPayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (!record.FromFull || typeof record.FromFull !== "object") return null;
  return raw as PostmarkInboundPayload;
};
