import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type DashboardModuleBadge = {
  label: string;
  tone?: "default" | "danger";
};

export const DashboardModuleCard = ({
  icon: Icon,
  title,
  addAction,
  badges,
  isPending,
  emptyMessage,
  viewAllHref,
  viewAllLabel,
  children,
}: {
  icon: LucideIcon;
  title: string;
  addAction?: React.ReactNode;
  badges: DashboardModuleBadge[];
  isPending?: boolean;
  emptyMessage: string;
  viewAllHref: string;
  viewAllLabel: string;
  children?: React.ReactNode;
}) => (
  <div className="flex min-h-0 flex-col gap-2">
    <div className="flex items-center gap-2">
      <Icon className="size-6 shrink-0 text-muted-foreground" />
      <h2 className="flex-1 text-xl font-semibold text-muted-foreground">
        {title}
      </h2>
      {addAction}
    </div>

    <Card className="flex min-h-[280px] flex-col gap-4 p-4">
      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <Badge
                  key={badge.label}
                  variant="outline"
                  className={cn(
                    badge.tone === "danger" &&
                      "border-red-200 text-red-700 dark:border-red-900/50 dark:text-red-400",
                  )}
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
          ) : null}

          {children ?? (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          )}

          <Link
            to={viewAllHref}
            className="mt-auto inline-flex items-center gap-1 text-sm link-action"
          >
            {viewAllLabel}
            <ChevronRight className="size-4" />
          </Link>
        </>
      )}
    </Card>
  </div>
);
