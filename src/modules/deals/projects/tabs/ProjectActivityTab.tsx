import { useMemo } from "react";
import { useGetList } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuthorBadge } from "@/components/atomic-crm/accountability/AuthorBadge";
import { formatDateTime } from "@/modules/clients/clientShowUtils";
import { FINANCIAL_DEAL_ACTIVITY_TYPES } from "@/lib/permissions/financialVisibility";
import { useCanViewAmounts } from "@/lib/permissions/useMaskedAmount";
import type { DealActivityUnified, LbsDeal } from "@/modules/types";

const ActivityLoading = () => (
  <div className="space-y-2 p-4">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
);

export const ProjectActivityTab = ({ record }: { record: LbsDeal }) => {
  const canViewAmounts = useCanViewAmounts();
  const { data: activities = [], isPending } = useGetList<DealActivityUnified>(
    "deal_activity_unified",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const visibleActivities = useMemo(() => {
    if (canViewAmounts) return activities;
    return activities.filter(
      (activity) => !FINANCIAL_DEAL_ACTIVITY_TYPES.has(activity.activity_type),
    );
  }, [activities, canViewAmounts]);

  if (isPending) return <ActivityLoading />;

  if (visibleActivities.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No activity yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-44 px-4">When</TableHead>
          <TableHead className="px-4">Activity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibleActivities.map((activity) => (
          <TableRow key={`${activity.activity_type}-${activity.activity_id}`}>
            <TableCell className="px-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              {formatDateTime(activity.created_at)}
            </TableCell>
            <TableCell className="px-4">
              <div className="flex min-w-0 items-center gap-2">
                <AuthorBadge memberId={activity.member_id} />
                <span className="truncate text-sm">{activity.description}</span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
