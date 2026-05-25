import { formatDistanceToNow } from "date-fns";
import { useGetList } from "ra-core";
import { AuthorBadge } from "@/components/atomic-crm/accountability/AuthorBadge";
import type { DealActivityUnified, LbsDeal } from "@/lbs/types";

export const ProjectActivityTab = ({ record }: { record: LbsDeal }) => {
  const { data: activities = [], isPending } = useGetList<DealActivityUnified>(
    "deal_activity_unified",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  if (isPending) return null;

  return (
    <div className="space-y-3">
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        activities.map((activity) => (
          <div
            key={`${activity.activity_type}-${activity.activity_id}`}
            className="flex items-start gap-3 border-l-2 border-muted p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <AuthorBadge memberId={activity.member_id} />
                <span className="text-sm">{activity.description}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {activity.created_at
                  ? formatDistanceToNow(new Date(String(activity.created_at)), {
                      addSuffix: true,
                    })
                  : ""}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
