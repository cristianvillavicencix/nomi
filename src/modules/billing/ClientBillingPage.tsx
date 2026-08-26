import { useGetIdentity } from "ra-core";
import { useLocation, useSearchParams } from "react-router";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { ClientInvoicesTab } from "@/modules/billing/ClientInvoicesTab";
import { ClientBillingReportsTab } from "@/modules/billing/reports/ClientBillingReportsTab";
import { isBillingInvoiceWorkspace } from "@/modules/billing/billingWorkspaceMode";
import { ClientSubscriptionsTab } from "@/modules/billing/subscriptions/ClientSubscriptionsTab";
import {
  BILLING_TABS,
  buildBillingTabSearchParams,
  isBillingSubscriptionWorkspace,
  resolveBillingTab,
  type BillingTabId,
} from "@/modules/billing/subscriptions/billingNavigation";
import { SettingsSubNav } from "@/modules/settings/SettingsSubNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const ClientBillingPage = () => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveBillingTab(searchParams);
  const hasInvoiceOpen = isBillingInvoiceWorkspace(
    location.pathname,
    location.search,
  );
  const hasSubscriptionOpen = isBillingSubscriptionWorkspace(
    location.pathname,
    location.search,
  );
  const hasWorkspaceOpen = hasInvoiceOpen || hasSubscriptionOpen;
  const fillHeight = isMobile || hasWorkspaceOpen;

  if (!identity) return null;

  const handleTabChange = (tab: BillingTabId) => {
    setSearchParams(buildBillingTabSearchParams(tab, searchParams));
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        fillHeight ? "h-full" : "gap-3",
      )}
    >
      <PageActions>
        <PageTitle label="Billing" />
      </PageActions>

      <SettingsSubNav
        value={activeTab}
        onValueChange={handleTabChange}
        items={BILLING_TABS}
        fillHeight={fillHeight && activeTab !== "reports"}
        className={
          fillHeight && activeTab !== "reports" ? "min-h-0 flex-1" : undefined
        }
        content={
          activeTab === "subscriptions" ? (
            <ClientSubscriptionsTab />
          ) : activeTab === "reports" ? (
            <ClientBillingReportsTab />
          ) : (
            <ClientInvoicesTab />
          )
        }
      />
    </div>
  );
};

/** @deprecated Use ClientBillingPage */
export const ClientBillingList = ClientBillingPage;
