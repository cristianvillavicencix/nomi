import { useEffect, useMemo, useState } from "react";
import { useRefresh } from "ra-core";
import { useLocation, useSearchParams } from "react-router";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { CreateClientSubscriptionDialog } from "@/modules/billing/subscriptions/CreateClientSubscriptionDialog";
import { SubscriptionBillingWorkspace } from "@/modules/billing/subscriptions/SubscriptionBillingWorkspace";
import {
  buildSubscriptionListFilter,
  SUBSCRIPTION_FILTER_OPTIONS,
  type SubscriptionStatusFilter,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import { isBillingSubscriptionWorkspace } from "@/modules/billing/subscriptions/billingNavigation";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const fillHeight = isMobile || hasSubscriptionOpen;

  const listFilter = useMemo(
    () => buildSubscriptionListFilter(statusFilter),
    [statusFilter],
  );

  // Mobile chrome + opens create via ?create=subscription
  useEffect(() => {
    if (searchParams.get("create") !== "subscription") return;
    setCreateOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        fillHeight ? "min-h-0 flex-1 gap-0" : "gap-3",
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
        contentScrollable={!fillHeight}
        className={fillHeight ? "min-h-0 flex-1" : undefined}
        pagination={
          fillHeight ? (
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
          showSummaryCards={!hasSubscriptionOpen && !isMobile}
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
