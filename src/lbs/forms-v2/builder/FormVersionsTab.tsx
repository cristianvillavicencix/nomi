import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitCompare, History, Loader2, RotateCcw } from "lucide-react";
import { useNotify } from "ra-core";
import { useMemo, useState } from "react";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { useFormBuilder } from "@/lbs/forms-v2/builder/FormBuilderContext";
import { relativeTime } from "@/lbs/forms-v2/formBuilderUtils";
import {
  diffFormSchemas,
  summarizeSchemaDiff,
} from "@/lbs/forms-v2/schemaDiffUtils";
import type { FormInstanceVersion, FormSchemaV2 } from "@/lbs/forms-v2/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type FormVersionsTabProps = {
  formInstanceId: number;
  currentSchema: FormSchemaV2 | undefined;
};

type VersionRow = FormInstanceVersion & {
  author_name?: string | null;
};

export const FormVersionsTab = ({
  formInstanceId,
  currentSchema,
}: FormVersionsTabProps) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { setSchema } = useFormBuilder();
  const [diffVersion, setDiffVersion] = useState<VersionRow | null>(null);

  const { data: versions = [], isPending } = useQuery({
    queryKey: ["form-instance-versions", formInstanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_instance_versions")
        .select(
          "id, form_instance_id, version_number, schema, created_at, created_by_member_id",
        )
        .eq("form_instance_id", formInstanceId)
        .order("version_number", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as FormInstanceVersion[];
      const memberIds = [
        ...new Set(
          rows
            .map((row) => row.created_by_member_id)
            .filter((id): id is number => id != null),
        ),
      ];

      let memberNames = new Map<number, string>();
      if (memberIds.length > 0) {
        const { data: members } = await supabase
          .from("organization_members")
          .select("id, first_name, last_name, email")
          .in("id", memberIds);
        memberNames = new Map(
          (members ?? []).map((member) => [
            Number(member.id),
            `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() ||
              member.email ||
              "Team member",
          ]),
        );
      }

      return rows.map(
        (row): VersionRow => ({
          ...row,
          author_name: row.created_by_member_id
            ? (memberNames.get(row.created_by_member_id) ?? null)
            : null,
        }),
      );
    },
    enabled: formInstanceId > 0,
  });

  const restoreMutation = useMutation({
    mutationFn: async (version: VersionRow) => {
      const { error } = await supabase
        .from("form_instances")
        .update({ schema: version.schema })
        .eq("id", formInstanceId);
      if (error) throw error;
      setSchema(version.schema ?? { sections: [] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["form-instance-versions", formInstanceId],
      });
      notify("Schema restored from version history", { type: "success" });
    },
    onError: (error) => {
      notify(
        error instanceof Error ? error.message : "Failed to restore version",
        { type: "error" },
      );
    },
  });

  const diffEntries = useMemo(() => {
    if (!diffVersion) return [];
    return diffFormSchemas(currentSchema, diffVersion.schema);
  }, [currentSchema, diffVersion]);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading version history…
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="size-4" />
        Previous schema snapshots are saved automatically when you edit and
        save.
      </div>

      {versions.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
          No archived versions yet. Edit the form and save to create the first
          snapshot.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/20 px-3 py-3">
            <p className="font-medium">Current (live)</p>
            <p className="text-xs text-muted-foreground">Active schema</p>
          </div>

          {versions.map((version) => {
            const summary = summarizeSchemaDiff(
              diffFormSchemas(currentSchema, version.schema),
            );

            return (
              <div
                key={version.id}
                className="rounded-md border px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">v{version.version_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {relativeTime(version.created_at)}
                      {version.author_name ? ` — ${version.author_name}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDiffVersion(version)}
                    >
                      <GitCompare className="size-4" />
                      View diff
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={restoreMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Restore schema from v${version.version_number}? The current schema will be archived first.`,
                          )
                        ) {
                          restoreMutation.mutate(version);
                        }
                      }}
                    >
                      {restoreMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RotateCcw className="size-4" />
                      )}
                      Restore
                    </Button>
                  </div>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {summary.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={diffVersion != null}
        onOpenChange={(open) => !open && setDiffVersion(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Diff vs v{diffVersion?.version_number ?? ""}
            </DialogTitle>
            <DialogDescription>
              Changes between the selected version and the current live schema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Summary</Label>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {diffEntries.length === 0 ? (
                <li className="text-muted-foreground">No differences found.</li>
              ) : (
                diffEntries.map((entry) => (
                  <li key={`${entry.kind}-${entry.path}-${entry.detail ?? ""}`}>
                    {entry.kind === "added" && "+ "}
                    {entry.kind === "removed" && "− "}
                    {entry.kind === "changed" && "~ "}
                    {entry.path}
                    {entry.detail ? ` (${entry.detail})` : ""}
                  </li>
                ))
              )}
            </ul>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setDiffVersion(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
