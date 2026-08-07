import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useGetList } from "ra-core";
import { BillingStatusFilterMenu } from "@/modules/billing/BillingStatusFilterMenu";
import {
  countSubscriptionsByStatusFilter,
  SUBSCRIPTION_FILTER_OPTIONS,
  type SubscriptionStatusFilter,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import type { ClientSubscription } from "@/modules/types";
import { Button } from "@/components/ui/button";
import { ModuleSearchField } from "@/components/atomic-crm/layout/ModuleToolbar";

type SubscriptionListToolbarProps = {
  statusFilter: SubscriptionStatusFilter;
  onStatusFilterChange: (next: SubscriptionStatusFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (next: string) => void;
  onCreate: () => void;
  /** Sidebar with detail open: New stacks below search. Full list: New on the same row. */
  compact?: boolean;
};

export const SubscriptionListToolbar = ({
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  onCreate,
  compact = false,
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

  const newButton = (
    <Button
      type="button"
      variant="primary"
      size="sm"
      className={compact ? "w-full sm:w-auto" : "shrink-0"}
      onClick={onCreate}
    >
      <Plus className="size-4" />
      New subscription
    </Button>
  );

  if (compact) {
    return (
      <div className="flex shrink-0 flex-col gap-2 border-b bg-background px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <BillingStatusFilterMenu
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={SUBSCRIPTION_FILTER_OPTIONS}
            counts={counts}
            ariaLabel="Filter subscriptions"
          />
          <ModuleSearchField
            value={searchQuery}
            onChange={onSearchQueryChange}
            basePlaceholder="Search by client, plan, status"
            total={counts.all}
            itemSingular="subscription"
            className="min-w-0 flex-1 [&>div]:max-w-none"
          />
        </div>
        {newButton}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-b bg-background px-3 py-2">
      <BillingStatusFilterMenu
        value={statusFilter}
        onChange={onStatusFilterChange}
        options={SUBSCRIPTION_FILTER_OPTIONS}
        counts={counts}
        ariaLabel="Filter subscriptions"
      />
      <ModuleSearchField
        value={searchQuery}
        onChange={onSearchQueryChange}
        basePlaceholder="Search by client, plan, status"
        total={counts.all}
        itemSingular="subscription"
        className="min-w-0 flex-1 [&>div]:max-w-none"
      />
      {newButton}
    </div>
  );
};
