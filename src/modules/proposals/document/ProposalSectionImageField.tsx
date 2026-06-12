import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getProposalDocumentCopy } from "@/modules/proposals/document/proposalDocumentI18n";
import type { ProposalLocale } from "@/modules/proposals/document/proposalDocumentI18n";
import {
  isProposalImageUrl,
  uploadProposalImage,
} from "@/modules/proposals/document/uploadProposalImage";

export const ProposalSectionImage = ({
  src,
  alt,
  className,
  aspect = "video",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  aspect?: "video" | "wide" | "square" | "hero";
}) => {
  if (!isProposalImageUrl(src)) return null;

  const aspectClass =
    aspect === "hero"
      ? "aspect-[21/9] min-h-[140px]"
      : aspect === "wide"
        ? "aspect-[2/1]"
        : aspect === "square"
          ? "aspect-square"
          : "aspect-video";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-muted/30",
        aspectClass,
        className,
      )}
    >
      <img
        src={src!.trim()}
        alt={alt}
        className="size-full object-cover"
        loading="lazy"
      />
    </div>
  );
};

export const ProposalSectionImageField = ({
  locale,
  imageUrl,
  onChange,
  orgId,
  proposalId,
  label,
}: {
  locale: ProposalLocale;
  imageUrl?: string | null;
  onChange: (url: string | null) => void;
  orgId: number;
  proposalId: number;
  label?: string;
}) => {
  const copy = getProposalDocumentCopy(locale);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState(imageUrl ?? "");

  useEffect(() => {
    setUrlDraft(imageUrl ?? "");
  }, [imageUrl]);

  const applyUrl = () => {
    const trimmed = urlDraft.trim();
    onChange(trimmed ? trimmed : null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const publicUrl = await uploadProposalImage(file, orgId, proposalId);
      setUrlDraft(publicUrl);
      onChange(publicUrl);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
      <Label className="text-xs font-medium text-muted-foreground">
        {label ?? copy.sectionImageLabel}
      </Label>

      {isProposalImageUrl(imageUrl) ? (
        <div className="relative">
          <ProposalSectionImage
            src={imageUrl}
            alt={label ?? "Section"}
            aspect="video"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 size-8 shadow-sm"
            onClick={() => {
              setUrlDraft("");
              onChange(null);
            }}
            aria-label={copy.removeSectionImage}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-muted-foreground">
          <ImageIcon className="size-8 opacity-40" />
          <p className="text-xs">{copy.sectionImageEmpty}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Input
          value={urlDraft}
          onChange={(event) => setUrlDraft(event.target.value)}
          onBlur={applyUrl}
          placeholder={copy.sectionImageUrlPlaceholder}
          className="h-8 min-w-[200px] flex-1 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {copy.uploadSectionImage}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
      </div>
    </div>
  );
};
