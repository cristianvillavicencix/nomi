import type { LucideIcon, ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const CreateFormFieldHint = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <p
    className={cn(
      "flex items-start gap-1.5 text-xs leading-snug text-muted-foreground",
      className,
    )}
  >
    <Info className="mt-0.5 size-3.5 shrink-0 opacity-70" aria-hidden />
    <span>{children}</span>
  </p>
);

export const CreateFormFieldRow = ({
  children,
  columns = 2,
  className,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}) => (
  <div
    className={cn(
      "grid gap-4",
      columns === 1 && "grid-cols-1",
      columns === 2 && "grid-cols-1 sm:grid-cols-2",
      columns === 3 && "grid-cols-1 sm:grid-cols-3",
      className,
    )}
  >
    {children}
  </div>
);

type CreateFormStatusCardProps = {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
};

export const CreateFormStatusCard = ({
  active,
  label,
  description,
  onClick,
}: CreateFormStatusCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-lg border px-3 py-2.5 text-left transition-colors",
      active
        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
        : "border-border hover:bg-muted/40",
    )}
  >
    <p className="text-sm font-medium">{label}</p>
    <p className="text-xs text-muted-foreground">{description}</p>
  </button>
);

export const CreateFormSectionLabel = ({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) => (
  <p className="text-sm font-medium">
    {children}
    {required ? <span className="text-destructive"> *</span> : null}
  </p>
);

export const CreateFormCollapsible = ({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) => (
  <details
    className="group rounded-md border"
    open={defaultOpen ? true : undefined}
  >
    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-primary hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
      <span className="group-open:hidden">▸ {label}</span>
      <span className="hidden group-open:inline">▾ {label}</span>
    </summary>
    <div className="space-y-4 border-t px-4 pt-4 pb-4">{children}</div>
  </details>
);

export const CreateFormInfoBanner = ({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: ReactNode;
}) => {
  const BannerIcon = Icon ?? Info;
  return (
    <div className="flex gap-2 rounded-md border border-sky-200/80 bg-sky-50/80 px-3 py-2.5 text-sm text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
      <BannerIcon className="mt-0.5 size-4 shrink-0 opacity-80" aria-hidden />
      <div className="min-w-0 leading-snug">{children}</div>
    </div>
  );
};
