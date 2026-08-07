import { useMemo, useState } from "react";
import { useRefresh } from "ra-core";
import { useLocation } from "react-router";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { CreateClientSubscriptionDialog } from "@/modules/billing/subscriptions/CreateClientSubscriptionDialog";
import {
  SubscriptionBillingWorkspace,
} from "@/modules/billing/subscriptions/SubscriptionBillingWorkspace";
import {
  buildSubscriptionListFilter,
  type SubscriptionStatusFilter,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import { isBillingSubscriptionWorkspace } from "@/modules/billing/subscriptions/billingNavigation";
import { cn } from "@/lib/utils";

export const ClientSubscriptionsTab = () => {
  const [statusFilter, setStatusFilter] =
    useState<SubscriptionStatusFilter>("all");
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
