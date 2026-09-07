import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toneBadgeVariant, type Tone } from "./tone";

export const StatusPill = ({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) => (
  <Badge variant={toneBadgeVariant(tone)} className={cn(className)}>
    {children}
  </Badge>
);
