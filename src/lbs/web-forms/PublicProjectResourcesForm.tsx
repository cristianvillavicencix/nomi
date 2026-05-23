import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { useSearchParams } from "react-router";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  fileToUploadItem,
  PROJECT_RESOURCE_TAB_CATEGORIES,
  type ProjectResourceTabCategory,
  type ProjectResourceUploadItem,
} from "@/lbs/deals/projectResourceConstants";

type ServiceUploadRow = {
  id: string;
  serviceName: string;
  files: File[];
};

const CategoryUploadField = ({
  label,
  description,
  files,
  onChange,
}: {
  label: string;
  description: string;
  files: File[];
  onChange: (files: File[]) => void;
}) => (
  <div className="rounded-lg border p-4 space-y-3">
    <div>
      <div className="font-medium">{label}</div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <Input
      type="file"
      accept="image/*,.pdf,.svg"
      multiple
      onChange={(event) => onChange(Array.from(event.target.files ?? []))}
    />
    {files.length > 0 ? (
      <p className="text-xs text-muted-foreground">
        {files.length} file{files.length === 1 ? "" : "s"} selected
      </p>
    ) : null}
  </div>
);

export const PublicProjectResourcesForm = () => {
  const [searchParams] = useSearchParams();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const dealId = searchParams.get("deal_id");
  const companyId = searchParams.get("company_id");
  const contactId = searchParams.get("contact_id");

  const [categoryFiles, setCategoryFiles] = useState<
    Partial<Record<ProjectResourceTabCategory, File[]>>
  >({});
  const [serviceRows, setServiceRows] = useState<ServiceUploadRow[]>([
    { id: crypto.randomUUID(), serviceName: "", files: [] },
  ]);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit =
    "submitProjectResources" in dataProvider &&
    typeof dataProvider.submitProjectResources === "function";

  const totalSelected = useMemo(() => {
    const staticCount = Object.values(categoryFiles).reduce(
      (sum, files) => sum + (files?.length ?? 0),
      0,
    );
    const serviceCount = serviceRows.reduce(
      (sum, row) => sum + row.files.length,
      0,
    );
    return staticCount + serviceCount;
  }, [categoryFiles, serviceRows]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!dealId)
        throw new Error("This upload link is missing the project id.");
      if (!canSubmit) {
        throw new Error("Upload is not available in this environment");
      }

      const items: ProjectResourceUploadItem[] = [];

      for (const categoryDef of PROJECT_RESOURCE_TAB_CATEGORIES) {
        if (categoryDef.id === "service-photo") continue;
        const files = categoryFiles[categoryDef.id] ?? [];
        for (const file of files) {
          items.push(await fileToUploadItem(file, categoryDef.id));
        }
      }

      for (const row of serviceRows) {
        if (!row.files.length) continue;
        if (!row.serviceName.trim()) {
          throw new Error("Enter a service name for each service photo upload");
        }
        for (const file of row.files) {
          items.push(
            await fileToUploadItem(
              file,
              "service-photo",
              row.serviceName.trim(),
            ),
          );
        }
      }

      if (items.length === 0) {
        throw new Error("Choose at least one file to upload");
      }

      return dataProvider.submitProjectResources({
        dealId,
        companyId,
        contactId,
        items,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      notify("Files uploaded. Thank you!", { type: "info" });
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to upload files", { type: "error" });
    },
  });

  if (!dealId) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-sm text-muted-foreground">
        This upload link is invalid or incomplete.
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg space-y-3 p-6 text-center">
        <h1 className="text-2xl font-semibold">Thank you</h1>
        <p className="text-sm text-muted-foreground">
          Your files were uploaded and organized in the project workspace. Our
          team will review them shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload project files</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Share logos, service photos, team images, and other assets for your
          project. Each section keeps files organized for our team.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutate();
        }}
      >
        {PROJECT_RESOURCE_TAB_CATEGORIES.filter(
          (entry) => entry.id !== "service-photo",
        ).map((categoryDef) => (
          <CategoryUploadField
            key={categoryDef.id}
            label={categoryDef.clientLabel}
            description={categoryDef.description}
            files={categoryFiles[categoryDef.id] ?? []}
            onChange={(files) =>
              setCategoryFiles((current) => ({
                ...current,
                [categoryDef.id]: files,
              }))
            }
          />
        ))}

        <div className="rounded-lg border p-4 space-y-4">
          <div>
            <div className="font-medium">Photos of your services</div>
            <p className="text-sm text-muted-foreground">
              Add one row per service and upload photos for each one.
            </p>
          </div>

          {serviceRows.map((row, index) => (
            <div
              key={row.id}
              className="space-y-2 rounded-md border bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`service-name-${row.id}`}>
                  Service {index + 1}
                </Label>
                {serviceRows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setServiceRows((current) =>
                        current.filter((entry) => entry.id !== row.id),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              <Input
                id={`service-name-${row.id}`}
                value={row.serviceName}
                onChange={(event) =>
                  setServiceRows((current) =>
                    current.map((entry) =>
                      entry.id === row.id
                        ? { ...entry, serviceName: event.target.value }
                        : entry,
                    ),
                  )
                }
                placeholder="e.g. Kitchen remodeling"
              />
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) =>
                  setServiceRows((current) =>
                    current.map((entry) =>
                      entry.id === row.id
                        ? {
                            ...entry,
                            files: Array.from(event.target.files ?? []),
                          }
                        : entry,
                    ),
                  )
                }
              />
              {row.files.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {row.files.length} photo{row.files.length === 1 ? "" : "s"}{" "}
                  selected
                </p>
              ) : null}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setServiceRows((current) => [
                ...current,
                { id: crypto.randomUUID(), serviceName: "", files: [] },
              ])
            }
          >
            <Plus className="size-4" />
            Add another service
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-sm text-muted-foreground">
            {totalSelected} file{totalSelected === 1 ? "" : "s"} selected
          </p>
          <Button
            type="submit"
            disabled={isPending || totalSelected === 0 || !canSubmit}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isPending ? "Uploading…" : "Submit files"}
          </Button>
        </div>
      </form>
    </div>
  );
};
