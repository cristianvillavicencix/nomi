import { cn } from "@/lib/utils";

export const TicketMetaSep = ({
  tone = "default",
}: {
  tone?: "default" | "soft";
}) => (
  <span
    className={cn(
      "px-1",
      tone === "soft" ? "text-muted-foreground/35" : "text-muted-foreground/50",
    )}
    aria-hidden
  >
    |
  </span>
);
