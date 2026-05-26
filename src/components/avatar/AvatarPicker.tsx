import { useCallback, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useNotify } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

import {
  PEEPS_GALLERY_SEEDS,
  peepUrlFromSeed,
  seedFromPeepUrl,
} from "./openPeeps";
import {
  initialsOf,
  resolveAvatarUrl,
  type AvatarBearingRecord,
  type AvatarType,
} from "./resolveAvatar";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export type AvatarPickerValue = {
  avatar_type: AvatarType | null;
  avatar_url: string | null;
};

export type AvatarPickerProps = {
  /** Current saved selection (or empty). */
  value: AvatarPickerValue;
  onChange: (next: AvatarPickerValue) => void;
  /**
   * Record being edited (used to derive the deterministic fallback peep and
   * the initials for the preview). Optional but recommended.
   */
  record?: AvatarBearingRecord | null;
  /**
   * `auth.users.id` of the currently authenticated user — required by the
   * Storage RLS policy so uploads land under `{auth.uid}/...`. If omitted,
   * the upload section is hidden.
   */
  authUserId?: string | null;
  /** Optional folder prefix inside the user's auth.uid folder. */
  folder?: string;
  className?: string;
};

export const AvatarPicker = ({
  value,
  onChange,
  record,
  authUserId,
  folder,
  className,
}: AvatarPickerProps) => {
  const notify = useNotify();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [galleryOffset, setGalleryOffset] = useState(0);

  const previewUrl = useMemo(
    () =>
      resolveAvatarUrl(
        {
          ...(record ?? {}),
          avatar_type: value.avatar_type ?? null,
          avatar_url: value.avatar_url ?? null,
        },
        192,
      ),
    [record, value.avatar_type, value.avatar_url],
  );

  const initials = useMemo(() => initialsOf(record), [record]);
  const selectedSeed = useMemo(
    () =>
      value.avatar_type === "peep" ? seedFromPeepUrl(value.avatar_url) : null,
    [value.avatar_type, value.avatar_url],
  );

  const handlePickPeep = (seed: string) => {
    onChange({
      avatar_type: "peep",
      avatar_url: peepUrlFromSeed(seed, 192),
    });
  };

  const handleUseDefault = () => {
    onChange({ avatar_type: "default", avatar_url: null });
  };

  const handleShuffleGallery = () => {
    setGalleryOffset(
      (prev) =>
        (prev + PEEPS_GALLERY_SEEDS.length / 2) % PEEPS_GALLERY_SEEDS.length,
    );
  };

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      if (!authUserId) {
        notify(
          "No puedo subir el archivo: falta la sesión de usuario autenticado.",
          { type: "error" },
        );
        return;
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        notify("Formato no soportado. Usa JPG, PNG o WebP.", { type: "error" });
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        notify(
          `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El máximo es 5 MB.`,
          { type: "error" },
        );
        return;
      }
      setUploading(true);
      try {
        const ext = file.name.includes(".")
          ? file.name.slice(file.name.lastIndexOf("."))
          : ".png";
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const folderPath = folder ? `${authUserId}/${folder}` : authUserId;
        const path = `${folderPath}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, file, {
            contentType: file.type,
            cacheControl: "3600",
            upsert: false,
          });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage
          .from("avatars")
          .getPublicUrl(path);
        if (!publicData?.publicUrl) {
          throw new Error("No se pudo obtener la URL pública del avatar");
        }
        onChange({
          avatar_type: "upload",
          avatar_url: publicData.publicUrl,
        });
        notify("Foto cargada", { type: "info" });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error al subir el archivo";
        notify(message, { type: "error" });
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [authUserId, folder, notify, onChange],
  );

  const visibleSeeds = useMemo(() => {
    if (galleryOffset === 0) return PEEPS_GALLERY_SEEDS;
    return [
      ...PEEPS_GALLERY_SEEDS.slice(galleryOffset),
      ...PEEPS_GALLERY_SEEDS.slice(0, galleryOffset),
    ];
  }, [galleryOffset]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-16 ring-2 ring-background">
            <AvatarImage src={previewUrl} alt="Avatar preview" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <p className="font-medium">Vista previa</p>
            <p className="text-xs text-muted-foreground">
              {value.avatar_type === "upload"
                ? "Foto personalizada"
                : value.avatar_type === "peep"
                  ? "Avatar Open Peeps"
                  : "Avatar por defecto"}
            </p>
          </div>
        </div>
        {value.avatar_type && value.avatar_type !== "default" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUseDefault}
            className="text-muted-foreground"
          >
            <Trash2 className="size-4" />
            Quitar selección
          </Button>
        ) : null}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Choose Avatar</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleShuffleGallery}
            className="text-muted-foreground"
          >
            <RefreshCw className="size-4" />
            Mezclar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Elige un personaje de Open Peeps. Tu selección se guarda al confirmar
          el formulario.
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {visibleSeeds.map((seed) => {
            const url = peepUrlFromSeed(seed, 128);
            const isSelected = selectedSeed === seed;
            return (
              <button
                type="button"
                key={seed}
                onClick={() => handlePickPeep(seed)}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-full border-2 bg-muted/30 transition-all",
                  "hover:scale-105 hover:border-primary hover:shadow",
                  isSelected
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-transparent",
                )}
                aria-pressed={isSelected}
                aria-label={`Seleccionar avatar ${seed}`}
              >
                <img
                  src={url}
                  alt={seed}
                  className="size-full object-cover"
                  loading="lazy"
                />
                {isSelected ? (
                  <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                    <Check className="size-3" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <Label className="text-base font-semibold">Upload your photo</Label>
        <p className="text-xs text-muted-foreground">
          JPG, PNG o WebP — máximo 5 MB. Tu foto reemplaza el avatar de Open
          Peeps mientras esté seleccionada.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !authUserId}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {value.avatar_type === "upload" ? "Reemplazar foto" : "Subir foto"}
          </Button>
          {value.avatar_type === "upload" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleUseDefault}
              disabled={uploading}
            >
              <Camera className="size-4" />
              Quitar foto
            </Button>
          ) : null}
          {!authUserId ? (
            <span className="text-xs text-muted-foreground">
              Las subidas requieren sesión activa
            </span>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(",")}
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </section>
    </div>
  );
};
