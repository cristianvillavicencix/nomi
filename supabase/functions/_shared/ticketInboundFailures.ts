import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { SkippedInboundAttachment } from "./inboundAttachmentLimits.ts";

export type TicketInboundFailureSource =
  | "sendgrid"
  | "postmark"
  | "manual_import";

export type LogTicketInboundFailureParams = {
  orgId: number;
  inboxId?: number | null;
  fromEmail?: string | null;
  fromName?: string | null;
  subject?: string | null;
  errorMessage: string;
  errorCode?: string | null;
  externalMessageId?: string | null;
  skippedAttachments?: SkippedInboundAttachment[];
  source?: TicketInboundFailureSource;
  ticketId?: number | null;
  rawPayload?: Record<string, unknown> | null;
};

export const logTicketInboundFailure = async (
  supabase: SupabaseClient,
  params: LogTicketInboundFailureParams,
) => {
  const externalMessageId = params.externalMessageId?.trim() || null;
  const errorCode = params.errorCode ?? null;

  if (externalMessageId && errorCode) {
    const { data: existing } = await supabase
      .from("ticket_inbound_failures")
      .select("id")
      .eq("org_id", params.orgId)
      .eq("external_message_id", externalMessageId)
      .eq("error_code", errorCode)
      .is("resolved_at", null)
      .maybeSingle();

    if (existing?.id) {
      if (params.rawPayload) {
        await supabase
          .from("ticket_inbound_failures")
          .update({ raw_payload: params.rawPayload })
          .eq("id", existing.id);
      }
      return;
    }
  }

  const { error } = await supabase.from("ticket_inbound_failures").insert({
    org_id: params.orgId,
    inbox_id: params.inboxId ?? null,
    from_email: params.fromEmail?.trim()?.toLowerCase() || null,
    from_name: params.fromName?.trim() || null,
    subject: params.subject?.trim() || null,
    error_message: params.errorMessage,
    error_code: errorCode,
    external_message_id: externalMessageId,
    skipped_attachments: params.skippedAttachments ?? [],
    source: params.source ?? "sendgrid",
    ticket_id: params.ticketId ?? null,
    raw_payload: params.rawPayload ?? null,
  });

  if (error) {
    console.error("ticketInboundFailures.insert_error", error);
  }
};

export type TicketInboundFailureRow = {
  id: number;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  error_message: string;
  error_code: string | null;
  skipped_attachments: SkippedInboundAttachment[];
  source: string;
  ticket_id: number | null;
  resolved_at: string | null;
  created_at: string;
  raw_payload?: Record<string, unknown> | null;
  retry_count?: number;
};

export const loadRecentTicketInboundFailures = async (
  supabase: SupabaseClient,
  orgId: number,
  limit = 20,
) => {
  const { data, error } = await supabase
    .from("ticket_inbound_failures")
    .select(
      "id, from_email, from_name, subject, error_message, error_code, skipped_attachments, source, ticket_id, resolved_at, created_at, raw_payload, retry_count",
    )
    .eq("org_id", orgId)
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    can_retry: Boolean(row.raw_payload),
  }));
};

export const countInboundFailuresLast7Days = async (
  supabase: SupabaseClient,
  orgId: number,
) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("ticket_inbound_failures")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("created_at", since);

  if (error) throw new Error(error.message);
  return count ?? 0;
};

export const loadInboundFailureForRetry = async (
  supabase: SupabaseClient,
  orgId: number,
  failureId: number,
) => {
  const { data, error } = await supabase
    .from("ticket_inbound_failures")
    .select(
      "id, org_id, source, raw_payload, retry_count, resolved_at, ticket_id, error_code",
    )
    .eq("org_id", orgId)
    .eq("id", failureId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
};

export const markInboundFailureRetried = async (
  supabase: SupabaseClient,
  orgId: number,
  failureId: number,
  ticketId?: number | null,
) => {
  const { data: current, error: loadError } = await supabase
    .from("ticket_inbound_failures")
    .select("retry_count")
    .eq("org_id", orgId)
    .eq("id", failureId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);

  const { error } = await supabase
    .from("ticket_inbound_failures")
    .update({
      retry_count: (current?.retry_count ?? 0) + 1,
      last_retry_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
      ...(ticketId ? { ticket_id: ticketId } : {}),
    })
    .eq("org_id", orgId)
    .eq("id", failureId);

  if (error) throw new Error(error.message);
};

export const dismissTicketInboundFailure = async (
  supabase: SupabaseClient,
  orgId: number,
  failureId: number,
) => {
  const { error } = await supabase
    .from("ticket_inbound_failures")
    .update({ resolved_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", failureId);

  if (error) throw new Error(error.message);
};

export const isPipelineStale = (
  lastInboundAt: string | null | undefined,
  alertHours: number,
) => {
  if (!lastInboundAt) return true;
  const hours = Number.isFinite(alertHours) && alertHours > 0 ? alertHours : 48;
  const elapsedMs = Date.now() - new Date(lastInboundAt).getTime();
  return elapsedMs > hours * 60 * 60 * 1000;
};

export const resetPipelineStaleNotification = async (
  supabase: SupabaseClient,
  inboxId: number,
) => {
  await supabase
    .from("ticket_inboxes")
    .update({ pipeline_stale_notified_at: null })
    .eq("id", inboxId);
};
