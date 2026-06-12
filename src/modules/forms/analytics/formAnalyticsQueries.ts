import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

export type FormAnalyticsMetrics = {
  views: number;
  starts: number;
  submissions: number;
  spamBlocked: number;
  rateLimited: number;
  completionRate: number | null;
  fieldCompletion: Array<{
    field_key: string;
    completions: number;
    completion_rate: number | null;
  }>;
  submissionsByDay: Array<{ date: string; count: number }>;
  sources: Array<{ source: string; count: number }>;
};

const countEvents = async (
  formInstanceId: number,
  eventType: string,
): Promise<number> => {
  const { count, error } = await supabase
    .from("form_submission_events")
    .select("*", { count: "exact", head: true })
    .eq("form_instance_id", formInstanceId)
    .eq("event_type", eventType);

  if (error) throw error;
  return count ?? 0;
};

export const fetchFormAnalytics = async (
  formInstanceId: number,
): Promise<FormAnalyticsMetrics> => {
  const [
    views,
    starts,
    submissionsResult,
    spamBlocked,
    rateLimited,
    fieldEvents,
  ] = await Promise.all([
    countEvents(formInstanceId, "viewed"),
    countEvents(formInstanceId, "started"),
    supabase
      .from("form_submissions_v2")
      .select("id, submitted_at, utm_source, source_url", { count: "exact" })
      .eq("form_instance_id", formInstanceId)
      .order("submitted_at", { ascending: false })
      .limit(1000),
    countEvents(formInstanceId, "spam_blocked"),
    countEvents(formInstanceId, "rate_limited"),
    supabase
      .from("form_submission_events")
      .select("field_key")
      .eq("form_instance_id", formInstanceId)
      .eq("event_type", "field_completed")
      .not("field_key", "is", null),
  ]);

  if (submissionsResult.error) throw submissionsResult.error;
  if (fieldEvents.error) throw fieldEvents.error;

  const submissions = submissionsResult.data ?? [];
  const submissionCount = submissionsResult.count ?? submissions.length;

  const fieldCounts = new Map<string, number>();
  for (const event of fieldEvents.data ?? []) {
    if (!event.field_key) continue;
    fieldCounts.set(
      event.field_key,
      (fieldCounts.get(event.field_key) ?? 0) + 1,
    );
  }

  const fieldCompletion = [...fieldCounts.entries()]
    .map(([field_key, completions]) => ({
      field_key,
      completions,
      completion_rate:
        starts > 0 ? Math.round((1000 * completions) / starts) / 10 : null,
    }))
    .sort((a, b) => (b.completion_rate ?? 0) - (a.completion_rate ?? 0));

  const dayCounts = new Map<string, number>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  for (const submission of submissions) {
    if (!submission.submitted_at) continue;
    const day = submission.submitted_at.slice(0, 10);
    const submitted = new Date(submission.submitted_at);
    if (submitted < cutoff) continue;
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  const submissionsByDay = [...dayCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const sourceCounts = new Map<string, number>();
  for (const submission of submissions) {
    const source =
      submission.utm_source?.trim() ||
      (submission.source_url
        ? (() => {
            try {
              return new URL(submission.source_url).hostname;
            } catch {
              return submission.source_url;
            }
          })()
        : "Direct");
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  const sources = [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    views,
    starts,
    submissions: submissionCount,
    spamBlocked,
    rateLimited,
    completionRate:
      starts > 0 ? Math.round((1000 * submissionCount) / starts) / 10 : null,
    fieldCompletion,
    submissionsByDay,
    sources,
  };
};

export type FormSubmissionEvent = {
  id: number;
  event_type: string;
  field_key?: string | null;
  created_at?: string;
  submission_id?: number | null;
};

export const fetchSubmissionTimeline = async (submission: {
  id: number;
  form_instance_id: number;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  status?: string | null;
}): Promise<FormSubmissionEvent[]> => {
  const submittedAt = submission.submitted_at
    ? new Date(submission.submitted_at)
    : new Date();
  const windowStart = new Date(submittedAt.getTime() - 2 * 60 * 60 * 1000);

  const [linkedResult, sessionResult] = await Promise.all([
    supabase
      .from("form_submission_events")
      .select("id, event_type, field_key, created_at, submission_id")
      .eq("submission_id", submission.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("form_submission_events")
      .select("id, event_type, field_key, created_at, submission_id")
      .eq("form_instance_id", submission.form_instance_id)
      .is("submission_id", null)
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", submittedAt.toISOString())
      .order("created_at", { ascending: true }),
  ]);

  if (linkedResult.error) throw linkedResult.error;
  if (sessionResult.error) throw sessionResult.error;

  const events = [...(linkedResult.data ?? []), ...(sessionResult.data ?? [])];
  const seen = new Set<number>();
  const deduped = events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });

  if (submission.reviewed_at) {
    deduped.push({
      id: -1,
      event_type: "status_changed",
      field_key: submission.status ?? "reviewed",
      created_at: submission.reviewed_at,
      submission_id: submission.id,
    });
  }

  return deduped.sort(
    (a, b) =>
      new Date(a.created_at ?? 0).getTime() -
      new Date(b.created_at ?? 0).getTime(),
  );
};
