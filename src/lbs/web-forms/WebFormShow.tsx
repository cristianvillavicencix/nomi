import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router";
import { ShowBase, useDataProvider, useGetList, useNotify, useShowContext } from "ra-core";
import { useNavigate, useParams } from "react-router";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Form, FormSubmission } from "@/lbs/types";
import { buildWebsiteIntakePayload } from "@/lbs/web-forms/intakeMapping";
import { SendWebFormPanel } from "@/lbs/web-forms/SendWebFormPanel";
import { getWebFormTypeLabel } from "@/lbs/web-forms/webFormLinks";

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const WebFormShow = () => {
  const { id } = useParams();
  if (!id) return null;

  return (
    <ShowBase resource="forms" id={id}>
      <WebFormShowContent />
    </ShowBase>
  );
};

const WebFormShowContent = () => {
  const { record, isPending } = useShowContext<Form>();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const navigate = useNavigate();

  const hasProcessIntake =
    "processWebsiteIntake" in dataProvider &&
    typeof (dataProvider as CrmDataProvider & { processWebsiteIntake?: unknown })
      .processWebsiteIntake === "function";

  const { mutate: processIntake, isPending: isProcessing } = useMutation({
    mutationFn: (submission: FormSubmission) =>
      (
        dataProvider as CrmDataProvider & {
          processWebsiteIntake: (payload: {
            formId: Form["id"];
            data: Record<string, unknown>;
          }) => Promise<{ deal_id?: number; company_id?: number }>;
        }
      ).processWebsiteIntake(
        buildWebsiteIntakePayload({
          formId: record!.id,
          data: submission.data ?? {},
        }),
      ),
    onSuccess: (result) => {
      notify("Intake processed");
      if (result?.deal_id) {
        navigate(`/deals/${result.deal_id}/show`);
      } else if (result?.company_id) {
        navigate(`/clients/${result.company_id}/show`);
      }
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to process intake", { type: "error" });
    },
  });

  const { data: submissions = [], isPending: submissionsPending } =
    useGetList<FormSubmission>(
      "form_submissions",
      {
        filter: { "form_id@eq": record?.id },
        pagination: { page: 1, perPage: 50 },
        sort: { field: "created_at", order: "DESC" },
      },
      { enabled: !!record?.id, staleTime: 30_000 },
    );

  if (isPending || !record) return null;

  return (
    <div className="mt-2 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{record.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>/{record.slug}</span>
            <Badge variant="outline">{getWebFormTypeLabel(record.slug)}</Badge>
            <Badge variant={record.active ? "default" : "outline"}>
              {record.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          {record.description ? (
            <p className="mt-2 text-sm text-muted-foreground">{record.description}</p>
          ) : null}
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to={`/web-forms/${record.id}/edit`}>Edit</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send to client</CardTitle>
        </CardHeader>
        <CardContent>
          <SendWebFormPanel form={record} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {submissionsPending ? null : submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <ul className="space-y-2">
              {submissions.map((submission) => (
                <li
                  key={submission.id}
                  className="rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Submission #{submission.id}</span>
                    <span className="text-muted-foreground">
                      {formatDateTime(submission.created_at)}
                    </span>
                  </div>
                  {submission.data && Object.keys(submission.data).length > 0 ? (
                    <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                      {JSON.stringify(submission.data, null, 2)}
                    </pre>
                  ) : null}
                  {hasProcessIntake &&
                  record.slug === "website-intake" &&
                  !submission.deal_id ? (
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="secondary"
                      disabled={isProcessing}
                      onClick={() => processIntake(submission)}
                    >
                      Process intake
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
