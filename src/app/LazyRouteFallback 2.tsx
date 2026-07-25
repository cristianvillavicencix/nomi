import { Skeleton } from "@/components/ui/skeleton";

export const LazyRouteFallback = ({ label }: { label: string }) => (
  <div className="flex min-h-[12rem] flex-col gap-3 p-6">
    <p className="text-sm text-muted-foreground">{label}</p>
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-32 w-full" />
  </div>
);
