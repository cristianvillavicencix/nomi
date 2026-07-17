import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EntityIdentityHeaderProps = {
  avatar: ReactNode;
  title: ReactNode;
  badges?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Soft tint behind the identity block */
  tone?: "sky" | "violet" | "neutral";
  className?: string;
  children?: ReactNode;
};

const toneClass: Record<
  NonNullable<EntityIdentityHeaderProps["tone"]>,
  string
> = {
  sky: "bg-gradient-to-br from-sky-50/80 via-background to-background dark:from-sky-950/30 dark:via-background",
  violet:
    "bg-gradient-to-br from-violet-50/80 via-background to-background dark:from-violet-950/30 dark:via-background",
  neutral: "bg-background",
};

/**
 * Shared Full/Preview identity chrome: avatar, title, badges, subtitle, actions.
 * Meta rows and social strips are passed as children below the top row.
 */
export const EntityIdentityHeader = ({
  avatar,
  title,
  badges,
  subtitle,
  actions,
  tone = "neutral",
  className,
  children,
}: EntityIdentityHeaderProps) => (
  <div
    className={cn(
      "overflow-hidden rounded-xl border border-border",
      toneClass[tone],
      className,
    )}
  >
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <div className="shrink-0">{avatar}</div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {badges}
          </div>
          {subtitle ? (
            <div className="min-w-0 text-sm text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
    {children}
  </div>
);
