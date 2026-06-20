import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/modules/types";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning",
  closed: "bg-muted text-muted-foreground",
  urgent: "bg-destructive/10 text-destructive",
};

export const StatusBadge = ({
  status,
}: {
  status?: Conversation["status"] | null;
}) => {
  const value = status ?? "open";
  return (
    <Badge
      variant="secondary"
      className={cn("rounded-full capitalize", STATUS_STYLES[value])}
    >
      {value}
    </Badge>
  );
};
