import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import { resolveMemberNotificationPhone } from "./notifyMeeting.ts";
import { sendOrgSms } from "./sendOrgSms.ts";

type TaskRow = {
  id: number;
  org_id: number;
  text?: string | null;
  due_date?: string | null;
  organization_member_id?: number | null;
  assignee_person_ids?: number[] | null;
  collaborator_person_ids?: number[] | null;
  done_date?: string | null;
};

const toMemberIds = (task: TaskRow, excludeMemberId?: number | null) => {
  const ids = new Set<number>();
  for (const value of task.assignee_person_ids ?? []) {
    const id = Number(value);
    if (Number.isFinite(id)) ids.add(id);
  }
  for (const value of task.collaborator_person_ids ?? []) {
    const id = Number(value);
    if (Number.isFinite(id)) ids.add(id);
  }
  if (task.organization_member_id != null) {
    ids.add(Number(task.organization_member_id));
  }
  if (excludeMemberId != null && Number.isFinite(excludeMemberId)) {
    ids.delete(Number(excludeMemberId));
  }
  return Array.from(ids);
};

const normalizeDueDateKey = (value?: string | null) => {
  if (!value?.trim()) return "";
  return String(value).slice(0, 10);
};

const formatDueDateLabel = (value?: string | null) => {
  const key = normalizeDueDateKey(value);
  if (!key) return "No due date";
  const parsed = new Date(`${key}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return key;
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const resolveAppBaseUrl = (fallback?: string | null) => {
  const envUrl =
    Deno.env.get("PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("VITE_PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("BILLING_PUBLIC_SITE_URL")?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (fallback?.trim()) return fallback.replace(/\/$/, "");
  return "";
};

export type NotifyTaskRescheduledResult = {
  ok: boolean;
  recipients: number;
  sent: number;
  skipped: number;
  reasons: string[];
};

export async function notifyTaskRescheduled(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    taskId: number;
    editorMemberId: number;
    previousDueDate?: string | null;
    appBaseUrl?: string | null;
  },
): Promise<NotifyTaskRescheduledResult> {
  const result: NotifyTaskRescheduledResult = {
    ok: true,
    recipients: 0,
    sent: 0,
    skipped: 0,
    reasons: [],
  };

  const { data: task, error } = await supabase
    .from("tasks")
    .select(
      "id, org_id, text, due_date, organization_member_id, assignee_person_ids, collaborator_person_ids, done_date",
    )
    .eq("id", params.taskId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (error || !task) {
    return { ...result, ok: false, reasons: ["task_not_found"] };
  }

  const row = task as TaskRow;
  if (row.done_date) {
    return { ...result, reasons: ["task_completed"] };
  }

  const previousKey = normalizeDueDateKey(params.previousDueDate);
  const currentKey = normalizeDueDateKey(row.due_date);
  if (previousKey && currentKey && previousKey === currentKey) {
    return { ...result, reasons: ["due_date_unchanged"] };
  }

  const recipientIds = toMemberIds(row, params.editorMemberId);
  result.recipients = recipientIds.length;
  if (recipientIds.length === 0) {
    return { ...result, reasons: ["no_recipients"] };
  }

  let settings;
  try {
    settings = await getMessagingSettingsSecrets(params.orgId);
  } catch {
    return { ...result, ok: false, reasons: ["settings_error"] };
  }

  if (!settings?.sms_enabled) {
    return { ...result, reasons: ["sms_not_configured"] };
  }

  const title = row.text?.trim() || "Task";
  const whenLabel = formatDueDateLabel(row.due_date);
  const previousLabel = previousKey
    ? formatDueDateLabel(previousKey)
    : null;
  const appUrl = resolveAppBaseUrl(params.appBaseUrl);
  const openLine = appUrl ? `\n\nOpen: ${appUrl}/tasks` : "";
  const body = previousLabel
    ? `Task rescheduled: ${title}\nWas: ${previousLabel}\nNow due: ${whenLabel}${openLine}`
    : `Task rescheduled: ${title}\nDue: ${whenLabel}${openLine}`;

  for (const memberId of recipientIds) {
    const phone = await resolveMemberNotificationPhone(supabase, memberId);
    if (!phone) {
      result.skipped += 1;
      continue;
    }

    try {
      await sendOrgSms({
        orgId: params.orgId,
        to: phone,
        body: body.slice(0, 1600),
      });
      result.sent += 1;
    } catch (sendError) {
      result.skipped += 1;
      result.reasons.push(
        sendError instanceof Error ? sendError.message : "sms_failed",
      );
    }
  }

  return result;
}
