import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormFieldDef } from "@/modules/forms/types";
import { FormFileUploadZone } from "@/modules/forms/public/fields/FormFileUploadZone";
import {
  uploadFormFile,
  type UploadedFormFile,
} from "@/modules/forms/public/uploadFormFile";
import { PROJECT_RESOURCES_UPLOAD_LIMITS } from "@/modules/deals/projectResourcesUploadLimits";
import { formatTeamResourceLabel } from "@/modules/deals/teamResourceLabel";

export type TeamPhotoEntry = {
  id: string;
  person_name: string;
  person_role: string;
  file: UploadedFormFile | null;
};

const createEntryId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyEntry = (): TeamPhotoEntry => ({
  id: createEntryId(),
  person_name: "",
  person_role: "",
  file: null,
});

const isUploadedFile = (value: unknown): value is UploadedFormFile =>
  Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as UploadedFormFile).url === "string",
  );

/** Normalize legacy file[] answers into person+role entries. */
export const normalizeTeamPhotoEntries = (value: unknown): TeamPhotoEntry[] => {
  if (!Array.isArray(value) || value.length === 0) return [];

  return value.map((entry) => {
    if (isUploadedFile(entry)) {
      return {
        id: createEntryId(),
        person_name: "",
        person_role: "",
        file: entry,
      };
    }
    if (entry && typeof entry === "object") {
      const record = entry as Partial<TeamPhotoEntry> & {
        file?: UploadedFormFile | null;
      };
      return {
        id: record.id || createEntryId(),
        person_name: String(record.person_name ?? "").trim(),
        person_role: String(record.person_role ?? "").trim(),
        file: isUploadedFile(record.file) ? record.file : null,
      };
    }
    return createEmptyEntry();
  });
};

export const formatTeamPhotoLabel = (entry: {
  person_name?: string;
  person_role?: string;
  file?: { original_name?: string; name?: string } | null;
}) =>
  formatTeamResourceLabel({
    name: entry.person_name,
    role: entry.person_role,
    fallback: entry.file?.original_name ?? entry.file?.name ?? "Team photo",
  });

type TeamPhotosFieldProps = {
  field: FormFieldDef;
  value: unknown;
  token: string;
  disabled?: boolean;
  onChange: (next: TeamPhotoEntry[]) => void;
};

export const TeamPhotosField = ({
  field,
  value,
  token,
  disabled,
  onChange,
}: TeamPhotosFieldProps) => {
  const maxFiles =
    field.max_files ?? PROJECT_RESOURCES_UPLOAD_LIMITS.teamPhotos;
  const entries = normalizeTeamPhotoEntries(value);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const patchEntry = (id: string, patch: Partial<TeamPhotoEntry>) => {
    onChange(
      entries.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const addEntry = () => {
    if (entries.length >= maxFiles) return;
    onChange([...entries, createEmptyEntry()]);
  };

  const removeEntry = (id: string) => {
    onChange(entries.filter((entry) => entry.id !== id));
  };

  const uploadForEntry = async (id: string, files: File[]) => {
    const file = files[0];
    if (!file || !token) return;
    setUploadingId(id);
    try {
      const uploaded = await uploadFormFile(file, {
        token,
        fieldKey: field.key,
        groupKey: id,
      });
      patchEntry(id, { file: uploaded });
    } finally {
      setUploadingId(null);
    }
  };

  const visibleEntries = entries.length > 0 ? entries : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add up to {maxFiles} team photos. Include each person’s name and role
        at the company.
      </p>

      {visibleEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No team photos yet.</p>
          <Button
            type="button"
            className="mt-3"
            disabled={disabled}
            onClick={addEntry}
          >
            <Plus className="size-4" />
            Add team member
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleEntries.map((entry, index) => {
            const files = entry.file ? [entry.file] : [];
            const uploading = uploadingId === entry.id;
            return (
              <div
                key={entry.id}
                className="space-y-3 rounded-xl border bg-background p-3 sm:p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    Team member {index + 1}
                  </p>
                  <IconButton
                    type="button"
                    variant="secondary"
                    disabled={disabled}
                    aria-label={`Remove team member ${index + 1}`}
                    onClick={() => removeEntry(entry.id)}
                  >
                    <X className="size-4" />
                  </IconButton>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${field.key}-${entry.id}-name`}>
                      Name
                    </Label>
                    <Input
                      id={`${field.key}-${entry.id}-name`}
                      value={entry.person_name}
                      disabled={disabled}
                      placeholder="e.g. Maria Lopez"
                      onChange={(event) =>
                        patchEntry(entry.id, {
                          person_name: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${field.key}-${entry.id}-role`}>
                      Role
                    </Label>
                    <Input
                      id={`${field.key}-${entry.id}-role`}
                      value={entry.person_role}
                      disabled={disabled}
                      placeholder="e.g. Project manager"
                      onChange={(event) =>
                        patchEntry(entry.id, {
                          person_role: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Photo</Label>
                  <FormFileUploadZone
                    id={`${field.key}-${entry.id}-photo`}
                    accept={field.accept}
                    multiple={false}
                    maxFiles={1}
                    files={files}
                    disabled={disabled}
                    uploading={uploading}
                    uploadingCount={uploading ? 1 : 0}
                    compact
                    emptyTitle="Team photo"
                    emptySubtitle="1 image"
                    onFilesSelected={(next) =>
                      void uploadForEntry(entry.id, next)
                    }
                    onRemove={() => patchEntry(entry.id, { file: null })}
                  />
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={disabled || entries.length >= maxFiles}
            onClick={addEntry}
          >
            <Plus className="size-4" />
            {entries.length >= maxFiles
              ? `Maximum ${maxFiles} team photos`
              : "Add another team member"}
          </Button>
        </div>
      )}
    </div>
  );
};
