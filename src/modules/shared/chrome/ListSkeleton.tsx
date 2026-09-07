import { cn } from "@/lib/utils";

export const ListSkeleton = ({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) => (
  <div className={cn("space-y-2 p-4", className)} aria-hidden>
    {Array.from({ length: rows }, (_, index) => (
      <div
        key={index}
        className="h-10 animate-pulse rounded-md bg-muted/60"
      />
    ))}
  </div>
);
