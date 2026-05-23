import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lbs/types";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  closed: "bg-muted text-muted-foreground",
  urgent: "bg-red-500/10 text-red-700 dark:text-red-300",
};

export const StatusBadge = ({ status }: { status?: Conversation["status"] | null }) => {
  const value = status ?? "open";
  return (
    <Badge variant="secondary" className={cn("rounded-full capitalize", STATUS_STYLES[value])}>
      {value}
    </Badge>
  );
};
