import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  useGetOne,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Check,
  Download,
  Mail,
  MessageSquare,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { relativeTime } from "@/lbs/forms-v2/formBuilderUtils";
import {
  fetchSubmissionTimeline,
  type FormSubmissionEvent,
} from "@/lbs/forms-v2/analytics/formAnalyticsQueries";
import { SubmissionAnswerList } from "@/lbs/forms-v2/submissions/submissionAnswerRenderer";
import {
  SUBMISSION_STATUSES,
  SUBMISSION_STATUS_LABELS,
  isSubmissionStatus,
} from "@/lbs/forms-v2/submissions/submissionConstants";
import { exportSubmissionPdf } from "@/lbs/forms-v2/submissions/submissionPdfExport";
import type { FormInstance, FormSubmissionV2 } from "@/lbs/forms-v2/types";

const formatEventLabel = (event: FormSubmissionEvent) => {
  switch (event.event_type) {
    case "viewed":
      return "Form viewed";
    case "started":
      return "Form started";
    case "field_completed":
      return `Field "${event.field_key ?? "unknown"}" completed`;
    case "field_focused":
      return `Field "${event.field_key ?? "unknown"}" focused`;
    case "abandoned":
      return event.field_key
        ? `Form abandoned at "${event.field_key}"`
        : "Form abandoned";
    case "submitted":
      return "Submitted";
    case "spam_blocked":
      return "Spam blocked";
    case "rate_limited":
      return "Rate limited";
    case "status_changed":
      return `Status changed to "${event.field_key ?? "reviewed"}"`;
    default:
      return event.event_type;
  }
};

export const SubmissionDetailPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();

  const { data: submission, isPending } = useGetOne<FormSubmissionV2>(
    "form_submissions_v2",
    { id },
    { enabled: Boolean(id) },
  );

  const { data: form } = useGetOne<FormInstance>(
    "form_instances",
    { id: String(submission?.form_instance_id ?? "") },
    { enabled: Boolean(submission?.form_instance_id) },
  );

  const { data: timeline = [], isPending: timelinePending } = useQuery({
    queryKey: ["submission-timeline", id],
    enabled: Boolean(submission?.id),
    queryFn: () => fetchSubmissionTimeline(submission!),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!submission) return;
      await update(
        "form_submissions_v2",
        {
          id: submission.id,
          data: {
            status,
            reviewed_at:
              status === "reviewed" ? new Date().toISOString() : submission.reviewed_at,
          },
          previousData: submission,
        },
        { mutationMode: "pessimistic" },
      );
    },
    onSuccess: () => {
      refresh();
      notify("Submission updated", { type: "info" });
    },
    onError: () => {
      notify("Failed to update submission", { type: "error" });
    },
  });

  const utmSummary = useMemo(() => {
    const parts = [
      submission?.utm_source,
      submission?.utm_medium,
      submission?.utm_campaign,
    ].filter(Boolean);
    return parts.length ? parts.join(" / ") : null;
  }, [submission]);

  if (isPending || !submission) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <p className="text-sm text-muted-foreground">Loading submission…</p>
      </div>
    );
  }

  const currentStatus = isSubmissionStatus(submission.status)
    ? submission.status
    : "new";

  const createContactHref = `/leads/create?${new URLSearchParams({
    ...(submission.submitter_name
      ? { first_name: submission.submitter_name.split(" ")[0] ?? "" }
      : {}),
    ...(submission.submitter_email
      ? { email: submission.submitter_email }
      : {}),
    ...(submission.submitter_phone
      ? { phone: submission.submitter_phone }
      : {}),
  }).toString()}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => navigate("/forms-v2/submissions")}
          >
            <ArrowLeft className="mr-2 size-4" />
            Back to submissions
          </Button>
          <h1 className="text-2xl font-semibold">
            Submission #{submission.id}
          </h1>
          <p className="text-sm text-muted-foreground">
            {form?.name ?? "Form"} · {relativeTime(submission.submitted_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportSubmissionPdf(submission, form)}
          >
            <Download className="mr-2 size-4" />
            Export PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => statusMutation.mutate("reviewed")}
          >
            <Check className="mr-2 size-4" />
            Mark reviewed
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => statusMutation.mutate("spam")}
          >
            <ShieldAlert className="mr-2 size-4" />
            Send to spam
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
        <aside className="space-y-4 rounded-xl border p-4">
          <div>
            <h2 className="text-sm font-semibold">Metadata</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Submitted</dt>
                <dd>{relativeTime(submission.submitted_at)}</dd>
              </div>
              {submission.submitter_name ? (
                <div>
                  <dt className="text-muted-foreground">Name</dt>
                  <dd>{submission.submitter_name}</dd>
                </div>
              ) : null}
              {submission.submitter_email ? (
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{submission.submitter_email}</dd>
                </div>
              ) : null}
              {submission.submitter_phone ? (
                <div>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{submission.submitter_phone}</dd>
                </div>
              ) : null}
              {submission.ip_address ? (
                <div>
                  <dt className="text-muted-foreground">IP</dt>
                  <dd className="break-all">{String(submission.ip_address)}</dd>
                </div>
              ) : null}
              {submission.user_agent ? (
                <div>
                  <dt className="text-muted-foreground">User agent</dt>
                  <dd className="break-all text-xs">{submission.user_agent}</dd>
                </div>
              ) : null}
              {submission.source_url ? (
                <div>
                  <dt className="text-muted-foreground">Source URL</dt>
                  <dd className="break-all text-xs">{submission.source_url}</dd>
                </div>
              ) : null}
              {utmSummary ? (
                <div>
                  <dt className="text-muted-foreground">UTM</dt>
                  <dd>{utmSummary}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Linked resources</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                Contact:{" "}
                {submission.contact_id ? (
                  <Link
                    to={`/contacts/${submission.contact_id}/show`}
                    className="text-primary hover:underline"
                  >
                    #{submission.contact_id}
                  </Link>
                ) : (
                  "—"
                )}
              </li>
              <li>
                Deal:{" "}
                {submission.deal_id ? (
                  <Link
                    to={`/deals/${submission.deal_id}/show`}
                    className="text-primary hover:underline"
                  >
                    #{submission.deal_id}
                  </Link>
                ) : (
                  "—"
                )}
              </li>
              <li>
                Company:{" "}
                {submission.company_id ? (
                  <Link
                    to={`/clients/${submission.company_id}/show`}
                    className="text-primary hover:underline"
                  >
                    #{submission.company_id}
                  </Link>
                ) : (
                  "—"
                )}
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Status</label>
            <Select
              value={currentStatus}
              onValueChange={(value) => statusMutation.mutate(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBMISSION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {SUBMISSION_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </aside>

        <main className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Answers</h2>
            <Badge variant="outline">{form?.name ?? "Form"}</Badge>
          </div>
          <SubmissionAnswerList
            schema={form?.schema}
            answers={submission.answers}
          />

          <div className="flex flex-wrap gap-2 border-t pt-4">
            {!submission.contact_id ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link to={createContactHref}>
                  <UserPlus className="mr-2 size-4" />
                  Create contact
                </Link>
              </Button>
            ) : null}
            {submission.submitter_phone ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link
                  to={`/messages?phone=${encodeURIComponent(submission.submitter_phone)}`}
                >
                  <MessageSquare className="mr-2 size-4" />
                  Reply via SMS
                </Link>
              </Button>
            ) : null}
            {submission.submitter_email ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={`mailto:${submission.submitter_email}`}>
                  <Mail className="mr-2 size-4" />
                  Reply via email
                </a>
              </Button>
            ) : null}
          </div>
        </main>

        <aside className="rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Activity</h2>
          {timelinePending ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          ) : timeline.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No activity recorded yet.
            </p>
          ) : (
            <ol className="mt-4 space-y-4">
              {timeline.map((event) => (
                <li
                  key={`${event.id}-${event.created_at}`}
                  className="relative pl-4"
                >
                  <span className="absolute left-0 top-1.5 size-2 rounded-full bg-primary" />
                  <p className="text-sm">{formatEventLabel(event)}</p>
                  <p className="text-xs text-muted-foreground">
                    {relativeTime(event.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
};
