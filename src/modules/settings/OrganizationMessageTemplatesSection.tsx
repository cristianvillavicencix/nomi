import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  useCreate,
  useDelete,
  useGetIdentity,
  useGetList,
  useNotify,
  useUpdate,
} from "ra-core";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  SHORTCUT_TILE_COLORS,
  shortcutTileColor,
  templateTileLabel,
} from "@/lib/messages/expandMessageTemplate";
import { DEFAULT_MESSAGE_SHORTCUT_SAMPLES } from "@/lib/messages/defaultMessageShortcuts";
import type { MessageTemplate } from "@/modules/types";
import { cn } from "@/lib/utils";
import { SmsBodyLengthHint } from "@/modules/messages/SmsBodyLengthHint";
import {
  assertSmsBodyWithinLimit,
  isSmsLengthOverLimit,
  SMS_MAX_BODY_CHARS,
} from "@/modules/messages/smsMessageLimits";

type TemplateDraft = {
  name: string;
  body: string;
  shortcut_label: string;
  tile_color: string;
  composer_shortcut: boolean;
  shortcut_sort_order: number;
};

const emptyDraft = (): TemplateDraft => ({
  name: "",
  body: "",
  shortcut_label: "",
  tile_color: "",
  composer_shortcut: true,
  shortcut_sort_order: 0,
});

export const OrganizationMessageTemplatesSection = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const orgId = Number(identity?.org_id ?? 0);
  const canManage = useMemberCapability("messaging.templates.manage");
  const [create] = useCreate();
  const [update] = useUpdate();
  const [remove] = useDelete();

  const { data: templates = [], isPending } = useGetList<MessageTemplate>(
    "message_templates",
    {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "shortcut_sort_order", order: "ASC" },
      filter: { "is_archived@eq": false },
    },
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft());

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort(
        (left, right) =>
          (left.shortcut_sort_order ?? 0) - (right.shortcut_sort_order ?? 0) ||
          left.name.localeCompare(right.name),
      ),
    [templates],
  );

  const openCreate = () => {
    setEditing(null);
    setDraft({
      ...emptyDraft(),
      shortcut_sort_order: templates.length,
    });
    setDialogOpen(true);
  };

  const openEdit = (template: MessageTemplate) => {
    setEditing(template);
    setDraft({
      name: template.name,
      body: template.body,
      shortcut_label: template.shortcut_label ?? "",
      tile_color: template.tile_color ?? "",
      composer_shortcut: template.composer_shortcut ?? false,
      shortcut_sort_order: template.shortcut_sort_order ?? 0,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: draft.name.trim(),
        body: draft.body.trim(),
        shortcut_label: draft.shortcut_label.trim().slice(0, 3) || null,
        tile_color:
          draft.tile_color.trim() &&
          /^#[0-9a-fA-F]{6}$/.test(draft.tile_color.trim())
            ? draft.tile_color.trim()
            : null,
        composer_shortcut: draft.composer_shortcut,
        shortcut_sort_order: draft.shortcut_sort_order,
        language: "en" as const,
        channels: ["sms"],
        is_archived: false,
      };

      if (!payload.name || !payload.body) {
        throw new Error("Name and message body are required");
      }

      assertSmsBodyWithinLimit(payload.body);

      if (editing) {
        return update(
          "message_templates",
          {
            id: editing.id,
            data: payload,
            previousData: editing,
          },
          { returnPromise: true },
        );
      }

      return create(
        "message_templates",
        {
          data: {
            ...payload,
            org_id: orgId,
            created_by_member_id: identity?.id ?? null,
          },
        },
        { returnPromise: true },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["message_templates"] });
      setDialogOpen(false);
      notify(editing ? "Shortcut updated" : "Shortcut created", {
        type: "success",
      });
    },
    onError: (error) => {
      notify(
        error instanceof Error ? error.message : "Could not save shortcut",
        {
          type: "error",
        },
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (template: MessageTemplate) =>
      remove(
        "message_templates",
        { id: template.id, previousData: template },
        { returnPromise: true },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["message_templates"] });
      notify("Shortcut deleted", { type: "success" });
    },
    onError: (error) => {
      notify(
        error instanceof Error ? error.message : "Could not delete shortcut",
        {
          type: "error",
        },
      );
    },
  });

  const loadSamplesMutation = useMutation({
    mutationFn: async () => {
      const existingNames = new Set(
        templates.map((template) => template.name.trim().toLowerCase()),
      );
      const toCreate = DEFAULT_MESSAGE_SHORTCUT_SAMPLES.filter(
        (sample) => !existingNames.has(sample.name.trim().toLowerCase()),
      );

      if (toCreate.length === 0) {
        return { created: 0 };
      }

      for (const sample of toCreate) {
        await create(
          "message_templates",
          {
            data: {
              org_id: orgId,
              name: sample.name,
              body: sample.body,
              shortcut_label: sample.shortcut_label,
              tile_color: sample.tile_color,
              composer_shortcut: sample.composer_shortcut,
              shortcut_sort_order: sample.shortcut_sort_order,
              language: sample.language,
              channels: ["sms"],
              variables: sample.variables,
              is_archived: false,
              created_by_member_id: identity?.id ?? null,
            },
          },
          { returnPromise: true },
        );
      }

      return { created: toCreate.length };
    },
    onSuccess: ({ created }) => {
      void queryClient.invalidateQueries({ queryKey: ["message_templates"] });
      if (created === 0) {
        notify("Sample shortcuts are already loaded", { type: "info" });
        return;
      }
      notify(
        created === 1
          ? "1 sample shortcut added"
          : `${created} sample shortcuts added`,
        { type: "success" },
      );
    },
    onError: (error) => {
      notify(
        error instanceof Error
          ? error.message
          : "Could not load sample shortcuts",
        { type: "error" },
      );
    },
  });

  if (!canManage) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        Only administrators can manage message shortcuts.
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading message shortcuts…
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Message shortcuts</CardTitle>
            <CardDescription>
              Quick-insert SMS templates shown as small tiles above the
              composer. Pin shortcuts to show them on the To line in Messages.
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => loadSamplesMutation.mutate()}
              disabled={loadSamplesMutation.isPending}
            >
              {loadSamplesMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Load samples
            </Button>
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Add shortcut
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shortcuts yet. Use{" "}
              <span className="font-medium">Load samples</span> for starter
              templates (supplements intake, hello, follow-up) or create your
              own.
            </p>
          ) : (
            sortedTemplates.map((template, index) => (
              <div
                key={String(template.id)}
                className="flex items-start gap-3 rounded-lg border bg-card p-3"
              >
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase text-white"
                  style={{
                    backgroundColor: shortcutTileColor(
                      template.tile_color,
                      index,
                    ),
                  }}
                >
                  {templateTileLabel(template.name, template.shortcut_label)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{template.name}</p>
                    {template.composer_shortcut ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Pinned
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                    {template.body}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    onClick={() => openEdit(template)}
                    aria-label={`Edit ${template.name}`}
                  >
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(template)}
                    disabled={deleteMutation.isPending}
                    aria-label={`Delete ${template.name}`}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </div>
            ))
          )}

          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Template variables</p>
            <p className="mt-1">
              <code>{`{{contact_first_name}}`}</code>,{" "}
              <code>{`{{contact_last_name}}`}</code>,{" "}
              <code>{`{{contact_full_name}}`}</code>,{" "}
              <code>{`{{company_name}}`}</code>,{" "}
              <code>{`{{user_first_name}}`}</code>,{" "}
              <code>{`{{org_name}}`}</code>
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit message shortcut" : "New message shortcut"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
              <div
                className="flex size-11 items-center justify-center rounded-md text-xs font-bold uppercase text-white"
                style={{
                  backgroundColor: shortcutTileColor(
                    draft.tile_color || null,
                    draft.shortcut_sort_order,
                  ),
                }}
              >
                {templateTileLabel(draft.name || "New", draft.shortcut_label)}
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Name</Label>
                  <Input
                    id="template-name"
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Follow up"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="template-tile-label">Tile label</Label>
                    <Input
                      id="template-tile-label"
                      value={draft.shortcut_label}
                      maxLength={3}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          shortcut_label: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="FU"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-sort">Sort order</Label>
                    <Input
                      id="template-sort"
                      type="number"
                      min={0}
                      value={draft.shortcut_sort_order}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          shortcut_sort_order: Number(event.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tile color</Label>
              <div className="flex flex-wrap gap-2">
                {SHORTCUT_TILE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "size-7 rounded-md border-2 transition-transform hover:scale-105",
                      draft.tile_color === color
                        ? "border-foreground"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() =>
                      setDraft((current) => ({ ...current, tile_color: color }))
                    }
                    aria-label={`Use color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-body">Message</Label>
              <Textarea
                id="template-body"
                value={draft.body}
                maxLength={SMS_MAX_BODY_CHARS}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    body: event.target.value,
                  }))
                }
                rows={5}
                placeholder="Hi {{contact_first_name}}, thanks for reaching out…"
              />
              <SmsBodyLengthHint body={draft.body} />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="template-composer-shortcut"
                checked={draft.composer_shortcut}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    composer_shortcut: checked,
                  }))
                }
              />
              <Label
                htmlFor="template-composer-shortcut"
                className="cursor-pointer"
              >
                Show as quick tile in Messages
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={
                saveMutation.isPending || isSmsLengthOverLimit(draft.body)
              }
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Save shortcut
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
