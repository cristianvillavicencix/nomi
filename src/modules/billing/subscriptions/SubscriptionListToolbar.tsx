import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useGetList } from "ra-core";
import {
  countSubscriptionsByStatusFilter,
  SUBSCRIPTION_FILTER_OPTIONS,
  type SubscriptionStatusFilter,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import type { ClientSubscription } from "@/modules/types";
import { Button } from "@/components/ui/button";
import { ModuleSearchField } from "@/components/atomic-crm/layout/ModuleToolbar";
import { cn } from "@/lib/utils";

type SubscriptionListToolbarProps = {
  statusFilter: SubscriptionStatusFilter;
  onStatusFilterChange: (next: SubscriptionStatusFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (next: string) => void;
  onCreate: () => void;
};

export const SubscriptionListToolbar = ({
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  onCreate,
}: SubscriptionListToolbarProps) => {
  const { data: subscriptions = [] } = useGetList<ClientSubscription>(
    "client_subscriptions",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "created_at", order: "DESC" },
      filter: {},
    },
    { staleTime: 30_000 },
  );

  const counts = useMemo(
    () => countSubscriptionsByStatusFilter(subscriptions),
    [subscriptions],
  );

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b bg-background px-3 py-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <ModuleSearchField
          value={searchQuery}
          onChange={onSearchQueryChange}
          basePlaceholder="Search by client, plan, status"
          total={counts.all}
          itemSingular="subscription"
        />

        <Button
          type="button"
          variant="primary"
          size="sm"
          className="shrink-0 sm:ml-auto"
          onClick={onCreate}
        >
          <Plus className="size-4" />
          New subscription
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {SUBSCRIPTION_FILTER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={statusFilter === option.value ? "secondary" : "ghost"}
            className={cn("h-7 px-2.5 text-xs")}
            onClick={() => onStatusFilterChange(option.value)}
          >
            {option.label}
            <span className="ml-1 text-muted-foreground">
              {counts[option.value]}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
};
