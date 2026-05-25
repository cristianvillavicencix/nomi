import { useMemo } from "react";
import { useGetList } from "ra-core";
import { Link, useSearchParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { relativeTime } from "@/lbs/forms-v2/formBuilderUtils";
import type { FormInstance, FormSubmissionV2 } from "@/lbs/forms-v2/types";

export const SubmissionsListPage = () => {
  const [searchParams] = useSearchParams();
  const formFilter = searchParams.get("form");

  const { data: submissions = [], isPending } = useGetList<FormSubmissionV2>(
    "form_submissions_v2",
    {
      filter: formFilter ? { "form_instance_id@eq": formFilter } : {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "submitted_at", order: "DESC" },
    },
  );

  const { data: forms = [] } = useGetList<FormInstance>("form_instances", {
    pagination: { page: 1, perPage: 100 },
  });

  const formNames = useMemo(
    () => new Map(forms.map((form) => [Number(form.id), form.name])),
    [forms],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Form submissions</h1>
        <p className="text-sm text-muted-foreground">
          Review responses from your public forms.
        </p>
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading submissions…</p>
      ) : submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No submissions yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>Submitter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    {formNames.get(Number(submission.form_instance_id)) ?? "—"}
                  </TableCell>
                  <TableCell>
                    {submission.submitter_name ||
                      submission.submitter_email ||
                      "Anonymous"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {submission.status ?? "new"}
                    </Badge>
                  </TableCell>
                  <TableCell>{relativeTime(submission.submitted_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Link to="/forms-v2" className="text-sm text-primary hover:underline">
        Back to forms
      </Link>
    </div>
  );
};
