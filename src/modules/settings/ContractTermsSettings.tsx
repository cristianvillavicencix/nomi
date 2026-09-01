import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Save, Star, Trash2 } from "lucide-react";
import {
  useCreate,
  useGetIdentity,
  useGetList,
  useNotify,
  useUpdate,
} from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { OrganizationContractTerms } from "@/modules/types";
import {
  getDefaultContractTermsSeed,
  LBS_DEFAULT_CONTRACT_TERMS_VERSION,
} from "@/modules/proposals/defaultContractTerms";

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "template";

type EditorMode = "closed" | "new" | "edit";

export const ContractTermsSettings = ({
  embedded = false,
}: {
  embedded?: boolean;
}) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const orgId = Number(identity?.org_id ?? 1);
  const [create] = useCreate();
  const [update] = useUpdate();

  const { data: termsRows = [], isPending } =
    useGetList<OrganizationContractTerms>("organization_contract_terms", {
      filter: {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "created_at", order: "DESC" },
    });

  const activeTemplates = useMemo(
    () => termsRows.filter((row) => row.is_active !== false),
    [termsRows],
  );

  const [editorMode, setEditorMode] = useState<EditorMode>("closed");
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const editingRow =
    editorMode === "edit"
      ? (activeTemplates.find((row) => String(row.id) === String(editingId)) ??
        null)
      : null;

  const [slug, setSlug] = useState("general");
  const [version, setVersion] = useState(LBS_DEFAULT_CONTRACT_TERMS_VERSION);
  const [title, setTitle] = useState(getDefaultContractTermsSeed().title);
  const [body, setBody] = useState(getDefaultContractTermsSeed().body_markdown);

  const dialogOpen = editorMode !== "closed";

  useEffect(() => {
    if (editorMode === "new") {
      setSlug("new-template");
      setVersion("1.0");
      setTitle("New contract template");
      setBody("# Contract\n\n**Client:** {{client_name}}\n\n{{line_items}}\n");
      return;
    }
    if (editorMode === "edit" && editingRow) {
      setSlug(editingRow.slug ?? "general");
      setVersion(editingRow.version);
      setTitle(editingRow.title);
      setBody(editingRow.body_markdown);
    }
  }, [editorMode, editingRow]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["organization_contract_terms"],
    });
  };

  const closeEditor = () => {
    setEditorMode("closed");
    setEditingId(null);
  };

  const openNew = () => {
    setEditingId(null);
    setEditorMode("new");
  };

  const openEdit = (row: OrganizationContractTerms) => {
    setEditingId(row.id);
    setEditorMode("edit");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        version: version.trim() || LBS_DEFAULT_CONTRACT_TERMS_VERSION,
        title: title.trim(),
        body_markdown: body,
        slug: slugify(slug),
        is_active: true,
      };
      if (editorMode === "edit" && editingRow) {
        return update(
          "organization_contract_terms",
          {
            id: editingRow.id,
            data: payload,
            previousData: editingRow,
          },
          { returnPromise: true },
        );
      }
      return create(
        "organization_contract_terms",
        {
          data: {
            org_id: orgId,
            ...payload,
            default_variables: getDefaultContractTermsSeed().default_variables,
            is_default: activeTemplates.length === 0,
            published_at: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      );
    },
    onSuccess: async () => {
      await invalidate();
      closeEditor();
      notify("Contract template saved", { type: "success" });
    },
    onError: (error) =>
      notify(
        error instanceof Error ? error.message : "Failed to save template",
        { type: "error" },
      ),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (row: OrganizationContractTerms) => {
      const currentDefault = activeTemplates.find((item) => item.is_default);
      if (currentDefault && String(currentDefault.id) !== String(row.id)) {
        await update(
          "organization_contract_terms",
          {
            id: currentDefault.id,
            data: { is_default: false },
            previousData: currentDefault,
          },
          { returnPromise: true },
        );
      }
      await update(
        "organization_contract_terms",
        {
          id: row.id,
          data: { is_default: true, is_active: true },
          previousData: row,
        },
        { returnPromise: true },
      );
    },
    onSuccess: async () => {
      await invalidate();
      notify("Default contract updated", { type: "success" });
    },
    onError: () =>
      notify("Failed to set default contract", { type: "error" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (row: OrganizationContractTerms) => {
      if (row.is_default) {
        throw new Error("Set another default before deactivating this template");
      }
      return update(
        "organization_contract_terms",
        {
          id: row.id,
          data: { is_active: false },
          previousData: row,
        },
        { returnPromise: true },
      );
    },
    onSuccess: async () => {
      if (editingId != null) closeEditor();
      await invalidate();
      notify("Template deactivated", { type: "success" });
    },
    onError: (error) =>
      notify(
        error instanceof Error ? error.message : "Failed to deactivate",
        { type: "error" },
      ),
  });

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading templates…</p>;
  }

  const editorDialog = (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (!open) closeEditor();
      }}
    >
      <DialogContent className="flex max-h-[min(92vh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4 pr-12 text-left">
          <DialogTitle>
            {editorMode === "new" ? "New contract template" : "Configure contract"}
          </DialogTitle>
          <DialogDescription>
            {editorMode === "edit" && editingRow
              ? `${editingRow.slug ?? "—"} · v${editingRow.version}`
              : "Slug, version, title, and markdown body for this agreement."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Version</Label>
              <Input
                value={version}
                onChange={(event) => setVersion(event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Body (Markdown)</Label>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={14}
              className="min-h-[240px] w-full font-mono text-xs"
            />
          </div>
          {editorMode === "new" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const seed = getDefaultContractTermsSeed();
                setSlug("general");
                setVersion(LBS_DEFAULT_CONTRACT_TERMS_VERSION);
                setTitle(seed.title);
                setBody(seed.body_markdown);
              }}
            >
              Load default LBS terms
            </Button>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={closeEditor}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const fields = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {activeTemplates.length} template
          {activeTemplates.length === 1 ? "" : "s"}
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={openNew}>
          <Plus className="size-3.5" />
          New
        </Button>
      </div>

      {activeTemplates.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No templates yet.</p>
          <Button
            type="button"
            className="mt-3"
            variant="secondary"
            onClick={openNew}
          >
            Create first template
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {activeTemplates.map((row) => (
            <Card
              key={String(row.id)}
              className={cn(
                "flex flex-col",
                row.is_default && "border-amber-400/60",
              )}
            >
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="flex items-start gap-2 text-sm leading-snug">
                  <span className="min-w-0 flex-1">{row.title}</span>
                  {row.is_default ? (
                    <Star className="mt-0.5 size-3.5 shrink-0 fill-amber-400 text-amber-500" />
                  ) : null}
                </CardTitle>
                <CardDescription className="text-xs">
                  {row.slug ?? "—"} · v{row.version}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-2">
                <p className="line-clamp-3 text-xs text-muted-foreground whitespace-pre-wrap">
                  {row.body_markdown.replace(/^#+\s*/gm, "").slice(0, 180) ||
                    "No body yet."}
                </p>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 border-t pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => openEdit(row)}
                >
                  <Pencil className="size-3.5" />
                  Configure
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={row.is_default || setDefaultMutation.isPending}
                  onClick={() => setDefaultMutation.mutate(row)}
                >
                  <Star className="size-3.5" />
                  Default
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={deactivateMutation.isPending}
                  onClick={() => deactivateMutation.mutate(row)}
                >
                  <Trash2 className="size-3.5" />
                  Deactivate
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {editorDialog}
    </div>
  );

  if (embedded) {
    return <div className="space-y-4">{fields}</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">Contract templates</CardTitle>
        <CardDescription>
          Library of agreements for proposals and subscription enrollment. Use{" "}
          {"{{variables}}"} such as client_name, line_items, total_amount,
          recurring_terms, terms_version.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{fields}</CardContent>
    </Card>
  );
};
