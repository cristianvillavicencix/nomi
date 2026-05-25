import { useMemo, useState } from "react";
import {
  useDelete,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  Archive,
  Check,
  Download,
  Eye,
  FileSpreadsheet,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { relativeTime } from "@/lbs/forms-v2/formBuilderUtils";
import {
  buildSubmissionListFilter,
  defaultSubmissionFilters,
  matchesSubmitterSearch,
  type SubmissionListFilters,
} from "@/lbs/forms-v2/submissions/submissionFilterUtils";
import {
  exportSubmissionsCsv,
  exportSubmissionsExcel,
} from "@/lbs/forms-v2/submissions/submissionExportUtils";
import {
  SUBMISSION_STATUSES,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_VARIANT,
  isSubmissionStatus,
} from "@/lbs/forms-v2/submissions/submissionConstants";
import { buildSubmissionStatusPatch } from "@/lbs/forms-v2/submissions/submissionStatusUpdate";
import type { FormInstance, FormSubmissionV2 } from "@/lbs/forms-v2/types";

export const SubmissionsListPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFormId = searchParams.get("form");
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();
  const [deleteOne] = useDelete();
  const { identity } = useGetIdentity();
  const [filters, setFilters] = useState<SubmissionListFilters>(() => ({
    ...defaultSubmissionFilters(),
    formIds: initialFormId ? [Number(initialFormId)].filter(Boolean) : [],
  }));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkPending, setBulkPending] = useState(false);

  const listFilter = useMemo(
    () => buildSubmissionListFilter(filters),
    [filters],
  );

  const { data: submissions = [], isPending } = useGetList<FormSubmissionV2>(
    "form_submissions_v2",
    {
      filter: listFilter,
      pagination: { page: 1, perPage: 500 },
      sort: { field: "submitted_at", order: "DESC" },
    },
  );

  const { data: forms = [] } = useGetList<FormInstance>("form_instances", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "name", order: "ASC" },
  });

  const formsById = useMemo(
    () => new Map(forms.map((form) => [Number(form.id), form])),
    [forms],
  );

  const visibleSubmissions = useMemo(
    () =>
      submissions.filter((submission) =>
        matchesSubmitterSearch(filters.submitterSearch, submission),
      ),
    [submissions, filters.submitterSearch],
  );

  const allVisibleSelected =
    visibleSubmissions.length > 0 &&
    visibleSubmissions.every((submission) =>
      selectedIds.includes(Number(submission.id)),
    );

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(
        visibleSubmissions.map((submission) => Number(submission.id)),
      );
      return;
    }
    setSelectedIds([]);
  };

  const toggleOne = (id: number, checked: boolean) => {
    setSelectedIds((current) =>
      checked
        ? [...new Set([...current, id])]
        : current.filter((item) => item !== id),
    );
  };

  const selectedSubmissions = visibleSubmissions.filter((submission) =>
    selectedIds.includes(Number(submission.id)),
  );

  const updateStatus = async (id: number, status: string) => {
    const previous = submissions.find((item) => Number(item.id) === id);
    if (!previous) return;
    await update(
      "form_submissions_v2",
      {
        id,
        data: buildSubmissionStatusPatch(
          status,
          previous,
          identity?.id != null ? Number(identity.id) : null,
        ),
        previousData: previous,
      },
      { mutationMode: "pessimistic" },
    );
    refresh();
  };

  const runBulk = async (action: "reviewed" | "spam" | "delete") => {
    if (selectedSubmissions.length === 0) return;
    setBulkPending(true);
    try {
      for (const submission of selectedSubmissions) {
        if (action === "delete") {
          await deleteOne("form_submissions_v2", {
            id: submission.id,
            previousData: submission,
          });
        } else {
          await update(
            "form_submissions_v2",
            {
              id: submission.id,
              data: buildSubmissionStatusPatch(
                action,
                submission,
                identity?.id != null ? Number(identity.id) : null,
              ),
              previousData: submission,
            },
            { mutationMode: "pessimistic" },
          );
        }
      }
      setSelectedIds([]);
      refresh();
      notify(
        action === "delete"
          ? "Selected submissions deleted"
          : `Marked as ${action}`,
        { type: "info" },
      );
    } catch {
      notify("Bulk action failed", { type: "error" });
    } finally {
      setBulkPending(false);
    }
  };

  const setFilter = <K extends keyof SubmissionListFilters>(
    key: K,
    value: SubmissionListFilters[K],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const toggleFormFilter = (formId: number, checked: boolean) => {
    setFilters((current) => ({
      ...current,
      formIds: checked
        ? [...new Set([...current.formIds, formId])]
        : current.formIds.filter((id) => id !== formId),
    }));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Form submissions</h1>
          <p className="text-sm text-muted-foreground">
            {visibleSubmissions.length} submission
            {visibleSubmissions.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectedSubmissions.length === 0}
            onClick={() => exportSubmissionsCsv(selectedSubmissions, formsById)}
          >
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectedSubmissions.length === 0}
            onClick={() =>
              exportSubmissionsExcel(selectedSubmissions, formsById)
            }
          >
            <FileSpreadsheet className="mr-2 size-4" />
            Export Excel
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/forms-v2">Back to forms</Link>
          </Button>
        </div>
      </div>

      <div className="sticky top-0 z-10 space-y-3 rounded-xl border bg-background/95 p-4 backdrop-blur">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Forms</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                >
                  {filters.formIds.length
                    ? `${filters.formIds.length} selected`
                    : "All forms"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-2" align="start">
                {forms.map((form) => (
                  <label
                    key={form.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={filters.formIds.includes(Number(form.id))}
                      onCheckedChange={(checked) =>
                        toggleFormFilter(Number(form.id), checked === true)
                      }
                    />
                    {form.name}
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilter("status", value as SubmissionListFilters["status"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {SUBMISSION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {SUBMISSION_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>From</Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilter("dateFrom", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>To</Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilter("dateTo", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Has contact</Label>
            <Select
              value={filters.hasContact}
              onValueChange={(value) =>
                setFilter(
                  "hasContact",
                  value as SubmissionListFilters["hasContact"],
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="yes">Linked</SelectItem>
                <SelectItem value="no">Not linked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Has deal</Label>
            <Select
              value={filters.hasDeal}
              onValueChange={(value) =>
                setFilter("hasDeal", value as SubmissionListFilters["hasDeal"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="yes">Linked</SelectItem>
                <SelectItem value="no">Not linked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Source / UTM</Label>
            <Input
              value={filters.sourceSearch}
              placeholder="facebook, newsletter…"
              onChange={(event) =>
                setFilter("sourceSearch", event.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Submitter</Label>
            <Input
              value={filters.submitterSearch}
              placeholder="Name, email, phone…"
              onChange={(event) =>
                setFilter("submitterSearch", event.target.value)
              }
            />
          </div>
        </div>

        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={bulkPending}
              onClick={() => runBulk("reviewed")}
            >
              <Check className="mr-2 size-4" />
              Mark reviewed
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={bulkPending}
              onClick={() => runBulk("spam")}
            >
              <ShieldAlert className="mr-2 size-4" />
              Mark spam
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={bulkPending}
              onClick={() => runBulk("delete")}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading submissions…</p>
      ) : visibleSubmissions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No submissions match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                  />
                </TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Submitter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Deal</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSubmissions.map((submission) => {
                const status = isSubmissionStatus(submission.status)
                  ? submission.status
                  : "new";
                const formName =
                  formsById.get(Number(submission.form_instance_id))?.name ??
                  "—";
                return (
                  <TableRow key={submission.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(Number(submission.id))}
                        onCheckedChange={(checked) =>
                          toggleOne(Number(submission.id), checked === true)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {relativeTime(submission.submitted_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formName}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {submission.submitter_name || "Anonymous"}
                      </div>
                      {submission.submitter_email ? (
                        <div className="text-xs text-muted-foreground">
                          {submission.submitter_email}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={status}
                        onValueChange={(value) =>
                          updateStatus(Number(submission.id), value)
                        }
                      >
                        <SelectTrigger className="h-8 w-[130px]">
                          <Badge variant={SUBMISSION_STATUS_VARIANT[status]}>
                            {SUBMISSION_STATUS_LABELS[status]}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {SUBMISSION_STATUSES.map((item) => (
                            <SelectItem key={item} value={item}>
                              {SUBMISSION_STATUS_LABELS[item]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate">
                      {submission.utm_source || submission.source_url || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            navigate(`/forms-v2/submissions/${submission.id}`)
                          }
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            updateStatus(Number(submission.id), "reviewed")
                          }
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            updateStatus(Number(submission.id), "archived")
                          }
                        >
                          <Archive className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
