import { ImageIcon, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  isProposalImageUrl,
  uploadProposalImage,
} from "@/modules/proposals/document/uploadProposalImage";

export const ProposalImageDropZone = ({
  imageUrl,
  onChange,
  orgId,
  proposalId,
  editable,
  aspectClass = "aspect-video",
  placeholder = "Click to upload a photo",
  initials,
  className,
  imageFit = "cover",
}: {
  imageUrl?: string | null;
  onChange?: (url: string | null) => void;
  orgId: number;
  proposalId: number;
  editable: boolean;
  aspectClass?: string;
  placeholder?: string;
  initials?: string;
  className?: string;
  /** cover = photos (team, profile); contain = logos */
  imageFit?: "cover" | "contain";
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const hasImage = isProposalImageUrl(imageUrl);

  const onFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/") || !onChange) return;
    setUploading(true);
    try {
      const url = await uploadProposalImage(file, orgId, proposalId);
      onChange(url);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (!editable) {
    if (!hasImage) {
      if (initials) {
        return (
          <div
            className={cn(
              "pf-drop flex items-center justify-center bg-gradient-to-br from-[#1E5FA8] to-[#0D3B6E] text-2xl font-extrabold text-white",
              aspectClass,
              className,
            )}
          >
            {initials}
          </div>
        );
      }
      return null;
    }
    return (
      <div className={cn("pf-drop", aspectClass, className)}>
        <img
          src={imageUrl!.trim()}
          alt=""
          className={cn(
            "size-full",
            imageFit === "contain" ? "object-contain p-2" : "object-cover",
          )}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "pf-drop group w-full text-left",
        aspectClass,
        hasImage && "border-solid",
        className,
      )}
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      {hasImage ? (
        <img
          src={imageUrl!.trim()}
          alt=""
          className={cn(
            "absolute inset-0 size-full",
            imageFit === "contain" ? "object-contain p-2" : "object-cover",
          )}
        />
      ) : (
        <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-4 text-center">
          {uploading ? (
            <Loader2 className="size-8 animate-spin text-[#1E5FA8]" />
          ) : (
            <>
              <div className="flex size-11 items-center justify-center rounded-xl bg-[#1E5FA8]/10 text-[#1E5FA8]">
                {initials ? (
                  <span className="text-sm font-bold">{initials}</span>
                ) : (
                  <ImageIcon className="size-5" />
                )}
              </div>
              <p className="text-sm font-medium text-[#475068]">
                {placeholder}
              </p>
              <p className="flex items-center gap-1 text-xs text-[#9aa3b5]">
                <Upload className="size-3.5" />
                Click to upload
              </p>
            </>
          )}
        </div>
      )}
      {hasImage && editable ? (
        <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
          Change photo
        </span>
      ) : null}
    </button>
  );
};
