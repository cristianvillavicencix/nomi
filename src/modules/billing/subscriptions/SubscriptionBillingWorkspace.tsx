import { Repeat } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { SubscriptionBillingSummaryCards } from "@/modules/billing/subscriptions/SubscriptionBillingSummaryCards";
import { StandaloneSubscriptionEditPage } from "@/modules/billing/subscriptions/StandaloneSubscriptionEditPage";
import { SubscriptionListSidebar } from "@/modules/billing/subscriptions/SubscriptionListSidebar";
import { SubscriptionListTable } from "@/modules/billing/subscriptions/SubscriptionListTable";
import { SubscriptionListToolbar } from "@/modules/billing/subscriptions/SubscriptionListToolbar";
import {
  type SubscriptionStatusFilter,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SubscriptionBillingWorkspaceProps = {
  statusFilter: SubscriptionStatusFilter;
  onStatusFilterChange: (next: SubscriptionStatusFilter) => void;
  onCreate: () => void;
  showSummaryCards?: boolean;
};

export const SubscriptionBillingWorkspace = ({
  statusFilter,
  onStatusFilterChange,
  onCreate,
  showSummaryCards = false,
}: SubscriptionBillingWorkspaceProps) => {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const selectedSubscriptionId = searchParams.get("subscription");

  const handleSelectSubscription = (subscriptionId: string) => {
    setSearchParams({
      tab: "subscriptions",
      subscription: subscriptionId,
    });
  };

  const handleBackToList = () => {
    setSearchParams({ tab: "subscriptions" });
  };

  const hasSelection = Boolean(selectedSubscriptionId);
  const showSidebar = !isMobile || !hasSelection;
  const showDetail = !isMobile || hasSelection;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 overflow-hidden bg-background",
        hasSelection && !isMobile
          ? "h-full rounded-none border-0"
          : "rounded-lg border",
      )}
    >
      {showSidebar ? (
        <aside
          className={cn(
            "flex min-h-0 flex-col bg-muted/10",
            hasSelection &&
              !isMobile &&
              "w-full max-w-[320px] shrink-0 border-r",
            (!hasSelection || isMobile) && "w-full",
          )}
        >
          <SubscriptionListToolbar
            statusFilter={statusFilter}
            onStatusFilterChange={onStatusFilterChange}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onCreate={onCreate}
            compact={hasSelection && !isMobile}
          />
          {showSummaryCards && !hasSelection ? (
            <div className="shrink-0 border-b bg-background px-3 py-2">
              <SubscriptionBillingSummaryCards
                statusFilter={statusFilter}
                onStatusFilterChange={onStatusFilterChange}
              />
            </div>
          ) : null}
          {hasSelection || isMobile ? (
            <SubscriptionListSidebar
              selectedSubscriptionId={selectedSubscriptionId}
              onSelectSubscription={handleSelectSubscription}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
            />
          ) : (
            <SubscriptionListTable
              selectedSubscriptionId={selectedSubscriptionId}
              onSelectSubscription={handleSelectSubscription}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
            />
          )}
        </aside>
      ) : null}

      {showDetail && hasSelection ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/50">
          {isMobile ? (
            <div className="border-b bg-background px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBackToList}
              >
                ← All subscriptions
              </Button>
            </div>
          ) : null}
          <StandaloneSubscriptionEditPage
            embedded
            subscriptionId={selectedSubscriptionId ?? ""}
          />
        </section>
      ) : !showSidebar ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
          <Repeat className="size-10 opacity-40" />
          <p className="text-sm">Select a subscription to view and edit.</p>
        </section>
      ) : null}
    </div>
  );
};
