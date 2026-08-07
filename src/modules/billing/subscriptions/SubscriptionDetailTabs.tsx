import { useSearchParams } from "react-router";
import {
  resolveSubscriptionSubview,
  SUBSCRIPTION_DETAIL_TABS,
  type SubscriptionDetailTab,
} from "@/modules/billing/subscriptions/billingNavigation";
import { cn } from "@/lib/utils";

type SubscriptionDetailTabsProps = {
  className?: string;
};

export const SubscriptionDetailTabs = ({
  className,
}: SubscriptionDetailTabsProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = resolveSubscriptionSubview(searchParams);

  const setTab = (tab: SubscriptionDetailTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "subscriptions");
    if (tab === "overview") {
      next.delete("subview");
    } else {
      next.set("subview", tab);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div
      className={cn(
        "flex gap-1 border-b border-border/60",
        className,
      )}
      role="tablist"
      aria-label="Subscription detail sections"
    >
      {SUBSCRIPTION_DETAIL_TABS.map(({ value, label }) => {
        const isActive = current === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setTab(value)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
