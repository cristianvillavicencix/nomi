import { Plus } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router";
import { useGetIdentity } from "ra-core";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { MobilePageChrome } from "@/components/atomic-crm/layout/MobilePageChrome";
import { IconButton } from "@/components/ui/icon-button";
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
  const showMobileCreate =
    activeTab === "invoices" && !hasInvoiceOpen;

  if (!identity) return null;

  const handleTabChange = (tab: BillingTabId) => {
    setSearchParams(buildBillingTabSearchParams(tab, searchParams));
  };

  const tabContent =
    activeTab === "subscriptions" ? (
      <ClientSubscriptionsTab />
    ) : activeTab === "reports" ? (
      <ClientBillingReportsTab />
    ) : (
      <ClientInvoicesTab />
    );

  if (isMobile) {
    // Detail views keep their own chrome; list hubs use the shared large title.
    if (hasWorkspaceOpen) {
      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)]">
          {tabContent}
        </div>
      );
    }

    return (
      <MobilePageChrome
        title="Invoices"
        scrollBody={false}
        action={
          showMobileCreate ? (
            <IconButton aria-label="New invoice" asChild>
              <Link to="/billing/invoices/new">
                <Plus className="size-6" />
              </Link>
            </IconButton>
          ) : undefined
        }
        search={
          <SettingsSubNav
            value={activeTab}
            onValueChange={handleTabChange}
            items={BILLING_TABS}
            embedded
          />
        }
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {tabContent}
        </div>
      </MobilePageChrome>
    );
  }

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
        content={tabContent}
      />
    </div>
  );
};

/** @deprecated Use ClientBillingPage */
export const ClientBillingHubPage = ClientBillingPage;
