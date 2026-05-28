import { useMemo, useState } from "react";
import {
  useCreate,
  useDataProvider,
  useDelete,
  useGetList,
  useNotify,
  useUpdate,
} from "ra-core";
import { Link, useNavigate } from "react-router";
import {
  Copy,
  ExternalLink,
  Lock,
  MoreHorizontal,
  Plus,
  Trash2,
  BarChart3,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { CreateFormDialog } from "@/lbs/forms-v2/CreateFormDialog";
import { SendFormButton } from "@/lbs/forms-v2/share/SendFormButton";
import { FORM_TYPE_LABELS } from "@/lbs/forms-v2/formBuilderConstants";
import { relativeTime } from "@/lbs/forms-v2/formBuilderUtils";
import type {
  FormInstance,
  FormSubmissionV2,
  FormTemplate,
} from "@/lbs/forms-v2/types";
import { toSlug } from "@/lib/toSlug";

export const FormsListPage = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const canManage = useMemberCapability("forms.manage");
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [update] = useUpdate();
  const [deleteOne] = useDelete();
  const [create] = useCreate();

  const { data: forms = [], isPending } = useGetList<FormInstance>(
    "form_instances",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
    },
  );

  const { data: templates = [] } = useGetList<FormTemplate>("form_templates", {
    filter: { "is_system@eq": true },
    pagination: { page: 1, perPage: 20 },
  });

  const { data: submissions = [] } = useGetList<FormSubmissionV2>(
    "form_submissions_v2",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "submitted_at", order: "DESC" },
    },
  );

  const templateById = useMemo(
    () => new Map(templates.map((template) => [Number(template.id), template])),
    [templates],
  );

  const submissionStats = useMemo(() => {
    const stats = new Map<number, { count: number; last?: string }>();
    for (const submission of submissions) {
      const formId = Number(submission.form_instance_id);
      const current = stats.get(formId) ?? { count: 0 };
      current.count += 1;
      if (!current.last) current.last = submission.submitted_at;
      stats.set(formId, current);
    }
    return stats;
  }, [submissions]);

  const filteredForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((form) => form.name.toLowerCase().includes(q));
  }, [forms, search]);

  const copyLinkMutation = useMutation({
    mutationFn: (formId: number) =>
      dataProvider.generateFormToken({
        formInstanceId: formId,
        maxUses: null,
        expiresInDays: 30,
      }),
    onSuccess: async (result) => {
      await navigator.clipboard.writeText(result.short_url ?? result.url);
      notify("Public form link copied", { type: "info" });
    },
    onError: () => notify("Failed to generate link", { type: "error" }),
  });

  const duplicateForm = (form: FormInstance) => {
    const copyName = `${form.name} copy`;
    create(
      "form_instances",
      {
        data: {
          name: copyName,
          slug: toSlug(copyName),
          schema: form.schema,
          template_id: form.template_id ?? null,
          description: form.description ?? null,
          is_active: true,
          is_public: true,
        },
      },
      {
        onSuccess: () => notify("Form duplicated", { type: "info" }),
        onError: () => notify("Failed to duplicate form", { type: "error" }),
      },
    );
  };

  const duplicateAsCustom = (form: FormInstance) => {
    const copyName = `${form.name} (Copy)`;
    const slug = `${toSlug(form.name)}-copy-${Date.now()}`;
    create(
      "form_instances",
      {
        data: {
          name: copyName,
          slug,
          schema: form.schema,
          template_id: null,
          description: form.description ?? null,
          is_active: true,
          is_public: true,
        },
      },
      {
        onSuccess: () => notify("Custom copy created", { type: "info" }),
        onError: () =>
          notify("Failed to create custom copy", { type: "error" }),
      },
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Forms</h1>
          <p className="text-sm text-muted-foreground">
            Build, share, and manage client-facing forms.
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New form
          </Button>
        ) : null}
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search forms…"
        className="max-w-sm"
      />

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading forms…</p>
      ) : filteredForms.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No forms yet. Create your first form from a template.
          </p>
          {canManage ? (
            <Button
              type="button"
              className="mt-4"
              variant="outline"
              onClick={() => setCreateOpen(true)}
            >
              Browse templates
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Last submission</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredForms.map((form) => {
                const template = form.template_id
                  ? templateById.get(Number(form.template_id))
                  : null;
                const isSystemForm = Boolean(template?.is_system);
                const stats = submissionStats.get(Number(form.id));
                return (
                  <TableRow key={form.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => navigate(`/forms-v2/${form.id}/edit`)}
                        >
                          {form.name}
                        </button>
                        {isSystemForm ? (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="size-3" />
                            System
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {FORM_TYPE_LABELS[template?.type ?? "custom"] ??
                          template?.type ??
                          "Custom"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/forms-v2/submissions?form=${form.id}`}
                        className="hover:underline"
                      >
                        {stats?.count ?? 0}
                      </Link>
                    </TableCell>
                    <TableCell>{relativeTime(stats?.last)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={Boolean(form.is_active)}
                        disabled={!canManage}
                        onCheckedChange={(checked) =>
                          update("form_instances", {
                            id: form.id,
                            data: { is_active: checked },
                            previousData: form,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/forms-v2/${form.id}/edit`)
                            }
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => void duplicateForm(form)}
                          >
                            <Copy className="size-4" />
                            Duplicate
                          </DropdownMenuItem>
                          {isSystemForm ? (
                            <DropdownMenuItem
                              onClick={() => void duplicateAsCustom(form)}
                            >
                              <Copy className="size-4" />
                              Duplicate as custom
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            onClick={() =>
                              copyLinkMutation.mutate(Number(form.id))
                            }
                          >
                            <ExternalLink className="size-4" />
                            Copy public link
                          </DropdownMenuItem>
                          <SendFormButton
                            variant="menu-item"
                            label="Send form"
                            formInstanceId={Number(form.id)}
                            context={{ type: "standalone" }}
                          />
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/forms-v2/${form.id}/analytics`)
                            }
                          >
                            <BarChart3 className="size-4" />
                            Analytics
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/forms-v2/submissions?form=${form.id}`)
                            }
                          >
                            View submissions
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete "${form.name}"? This cannot be undone.`,
                                )
                              ) {
                                deleteOne("form_instances", {
                                  id: form.id,
                                  previousData: form,
                                });
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
};
