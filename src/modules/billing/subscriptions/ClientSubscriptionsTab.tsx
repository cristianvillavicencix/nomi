import { useMemo, useState } from "react";
import { useRefresh } from "ra-core";
import { useLocation, useSearchParams } from "react-router";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { CreateClientSubscriptionDialog } from "@/modules/billing/subscriptions/CreateClientSubscriptionDialog";
import {
  SubscriptionBillingWorkspace,
} from "@/modules/billing/subscriptions/SubscriptionBillingWorkspace";
import {
  buildSubscriptionListFilter,
  SUBSCRIPTION_FILTER_OPTIONS,
  type SubscriptionStatusFilter,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import { isBillingSubscriptionWorkspace } from "@/modules/billing/subscriptions/billingNavigation";
import { cn } from "@/lib/utils";

const resolveSubscriptionStatusFromParams = (
  params: URLSearchParams,
): SubscriptionStatusFilter => {
  const value = params.get("subscription_status");
  const allowed = SUBSCRIPTION_FILTER_OPTIONS.map((option) => option.value);
  if (value && allowed.includes(value as SubscriptionStatusFilter)) {
    return value as SubscriptionStatusFilter;
  }
  return "all";
};

export const ClientSubscriptionsTab = () => {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatusFilter>(
    () => resolveSubscriptionStatusFromParams(searchParams),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const location = useLocation();
  const refresh = useRefresh();
  const hasSubscriptionOpen = isBillingSubscriptionWorkspace(
    location.pathname,
    location.search,
  );

  const listFilter = useMemo(
    () => buildSubscriptionListFilter(statusFilter),
    [statusFilter],
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        hasSubscriptionOpen ? "h-full flex-1 gap-0 overflow-hidden" : "gap-3",
      )}
    >
      <List
        resource="client_subscriptions"
        title={false}
        disableBreadcrumb
        perPage={50}
        sort={{ field: "created_at", order: "DESC" }}
        filter={listFilter}
        actions={false}
        contentScrollable={!hasSubscriptionOpen}
        className={hasSubscriptionOpen ? "min-h-0 flex-1" : undefined}
        pagination={
          hasSubscriptionOpen ? (
            false
          ) : (
            <ListPagination rowsPerPageOptions={[25, 50, 100]} />
          )
        }
      >
        <SubscriptionBillingWorkspace
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onCreate={() => setCreateOpen(true)}
          showSummaryCards={!hasSubscriptionOpen}
        />
      </List>

      <CreateClientSubscriptionDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) refresh();
        }}
      />
    </div>
  );
};
