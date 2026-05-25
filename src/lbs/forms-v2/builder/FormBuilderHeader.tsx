import { useState } from "react";
import { ExternalLink, Loader2, Save, Settings2 } from "lucide-react";
import { useDataProvider } from "ra-core";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useFormBuilder } from "@/lbs/forms-v2/builder/FormBuilderContext";
import { FormSettingsSheet } from "@/lbs/forms-v2/builder/FormSettingsSheet";
import { toSlug } from "@/lib/toSlug";

export const FormBuilderHeader = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { formInstance, setFormInstance, isDirty, isSaving, save } =
    useFormBuilder();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (isDirty) await save();
      const result = await dataProvider.generateFormToken({
        formInstanceId: Number(formInstance.id),
        expiresInDays: 0,
        maxUses: 1,
        isPreview: true,
      });
      window.open(result.url, "_blank", "noopener,noreferrer");
    },
  });

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={formInstance.name ?? ""}
              onChange={(event) =>
                setFormInstance({ name: event.target.value })
              }
              className="max-w-md font-semibold"
            />
            <Input
              value={formInstance.slug ?? ""}
              onChange={(event) =>
                setFormInstance({ slug: toSlug(event.target.value) })
              }
              className="max-w-xs font-mono text-sm"
              placeholder="slug"
            />
            <Badge variant={formInstance.is_active ? "default" : "outline"}>
              {formInstance.is_active ? "Active" : "Inactive"}
            </Badge>
            {isDirty ? (
              <span className="text-xs text-muted-foreground">
                Unsaved changes
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ExternalLink className="size-4" />
              )}
              Preview
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="size-4" />
              Settings
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>

      <FormSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};
