import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const WebsiteAuditAiTextBlock = ({
  title = "En palabras simples",
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-lg border border-violet-200/70 bg-violet-50/60 px-3 py-2.5 dark:border-violet-500/20 dark:bg-violet-950/20",
      className,
    )}
  >
    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-800 dark:text-violet-200">
      <Sparkles className="size-3.5 shrink-0" />
      {title}
    </p>
    <div className="text-sm leading-relaxed text-violet-950/90 dark:text-violet-100/90">
      {children}
    </div>
  </div>
);
