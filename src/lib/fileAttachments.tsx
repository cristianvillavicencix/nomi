import {
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FileAttachment = {
  title?: string;
  type?: string;
  src?: string;
};

export type FileKind =
  | "pdf"
  | "image"
  | "spreadsheet"
  | "document"
  | "archive"
  | "file";

export const getFileKind = (file: FileAttachment): FileKind => {
  const type = file.type?.toLowerCase() ?? "";
  const name = file.title?.toLowerCase() ?? "";

  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name)) {
    return "image";
  }
  if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    /\.(xlsx?|csv)$/i.test(name)
  ) {
    return "spreadsheet";
  }
  if (
    type.includes("word") ||
    type.includes("document") ||
    /\.(docx?|rtf|txt)$/i.test(name)
  ) {
    return "document";
  }
  if (
    type.includes("zip") ||
    type.includes("compressed") ||
    /\.(zip|rar|7z|tar|gz)$/i.test(name)
  ) {
    return "archive";
  }
  return "file";
};

const FILE_KIND_META: Record<
  FileKind,
  { Icon: LucideIcon; iconClassName: string; tileClassName: string }
> = {
  pdf: {
    Icon: FileText,
    iconClassName: "text-red-600",
    tileClassName: "bg-red-50",
  },
  image: {
    Icon: FileImage,
    iconClassName: "text-sky-600",
    tileClassName: "bg-sky-50",
  },
  spreadsheet: {
    Icon: FileSpreadsheet,
    iconClassName: "text-emerald-600",
    tileClassName: "bg-emerald-50",
  },
  document: {
    Icon: FileText,
    iconClassName: "text-blue-600",
    tileClassName: "bg-blue-50",
  },
  archive: {
    Icon: FileArchive,
    iconClassName: "text-amber-700",
    tileClassName: "bg-amber-50",
  },
  file: {
    Icon: File,
    iconClassName: "text-muted-foreground",
    tileClassName: "bg-muted/60",
  },
};

export const FileTypeIcon = ({
  file,
  className,
  iconClassName,
}: {
  file: FileAttachment;
  className?: string;
  iconClassName?: string;
}) => {
  const kind = getFileKind(file);
  const { Icon, iconClassName: defaultIconClass } = FILE_KIND_META[kind];
  return <Icon className={cn("size-4 shrink-0", defaultIconClass, iconClassName, className)} />;
};

export const FileAttachmentPill = ({ file }: { file: FileAttachment }) => {
  const kind = getFileKind(file);
  const { Icon, iconClassName } = FILE_KIND_META[kind];

  if (!file.src) return null;

  return (
    <a
      href={file.src}
      target="_blank"
      rel="noreferrer"
      title={file.title || "Attachment"}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
      onClick={(event) => event.stopPropagation()}
    >
      <Icon className={cn("size-3.5 shrink-0", iconClassName)} />
      <span className="truncate">{file.title || "Attachment"}</span>
    </a>
  );
};

export const FileAttachmentPillList = ({
  attachments,
  className,
}: {
  attachments: unknown[];
  className?: string;
}) => {
  const files = attachments
    .map((item) => item as FileAttachment)
    .filter((file) => file.src);

  if (!files.length) return null;

  return (
    <div className={cn("mt-3 flex flex-wrap gap-2", className)}>
      {files.map((file, index) => (
        <FileAttachmentPill key={`${file.src}-${index}`} file={file} />
      ))}
    </div>
  );
};

export const FileAttachmentIconLink = ({
  file,
  size = "md",
}: {
  file: FileAttachment;
  size?: "sm" | "md";
}) => {
  const kind = getFileKind(file);
  const { Icon, iconClassName, tileClassName } = FILE_KIND_META[kind];
  const tileSize = size === "sm" ? "size-7" : "size-9";
  const iconSize = size === "sm" ? "size-3.5" : "size-4";

  if (!file.src) return null;

  return (
    <a
      href={file.src}
      target="_blank"
      rel="noreferrer"
      title={file.title || "Attachment"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border transition-colors hover:opacity-90",
        tileSize,
        tileClassName,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <Icon className={cn(iconSize, iconClassName)} />
    </a>
  );
};

export const FileAttachmentIconRow = ({
  attachments,
  size = "md",
  max = 4,
}: {
  attachments: unknown[];
  size?: "sm" | "md";
  max?: number;
}) => {
  const files = attachments
    .map((item) => item as FileAttachment)
    .filter((file) => file.src);

  if (!files.length) return null;

  const visible = files.slice(0, max);
  const overflow = files.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((file, index) => (
        <FileAttachmentIconLink key={`${file.src}-${index}`} file={file} size={size} />
      ))}
      {overflow > 0 ? (
        <span className="text-[11px] text-muted-foreground">+{overflow}</span>
      ) : null}
    </div>
  );
};
