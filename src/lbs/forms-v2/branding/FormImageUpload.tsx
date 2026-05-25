import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormImageUploadProps = {
  label: string;
  folder: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  recommendedSize?: string;
  maxSizeKB?: number;
};

export const FormImageUpload = ({
  label,
  folder,
  value,
  onChange,
  recommendedSize,
  maxSizeKB = 500,
}: FormImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file.");
        return;
      }
      if (file.size > maxSizeKB * 1024) {
        setError(`Image must be ${maxSizeKB}KB or smaller.`);
        return;
      }

      setUploading(true);
      try {
        const ext = file.name.includes(".")
          ? file.name.slice(file.name.lastIndexOf("."))
          : "";
        const path = `${folder}/${crypto.randomUUID()}${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("form-branding")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage
          .from("form-branding")
          .getPublicUrl(path);
        onChange(data.publicUrl);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Upload failed",
        );
      } finally {
        setUploading(false);
      }
    },
    [folder, maxSizeKB, onChange],
  );

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {recommendedSize ? (
        <p className="text-xs text-muted-foreground">
          Recommended: {recommendedSize}. Max {maxSizeKB}KB.
        </p>
      ) : null}

      <div
        className={cn(
          "rounded-lg border border-dashed p-4 transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {value ? (
          <div className="space-y-3">
            <img
              src={value}
              alt=""
              className="max-h-32 w-auto rounded-md border object-contain"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={uploading}
                onClick={() => onChange(null)}
              >
                <Trash2 className="size-4" />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full flex-col items-center gap-2 py-6 text-sm text-muted-foreground"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
            {uploading ? "Uploading…" : "Drop an image or click to browse"}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadFile(file);
          event.target.value = "";
        }}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
};
