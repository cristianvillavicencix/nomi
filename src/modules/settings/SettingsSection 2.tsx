import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  children: ReactNode;
  className?: string;
};

/** In-page group label — no border or background. */
export const SettingsSection = ({ title, children, className }: Props) => (
  <section className={cn("w-full", className)}>
    {title ? (
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
    ) : null}
    {children}
  </section>
);

export const SettingsRows = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("divide-y divide-border/40", className)}>{children}</div>
);
