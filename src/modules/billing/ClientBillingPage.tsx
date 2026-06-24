import { useGetIdentity } from "ra-core";
import { useLocation } from "react-router";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { ClientInvoicesTab } from "@/modules/billing/ClientInvoicesTab";
import { isBillingInvoiceWorkspace } from "@/modules/billing/billingWorkspaceMode";
import { LBS_PLACEHOLDER_MODULES } from "@/app/navigation";
import { cn } from "@/lib/utils";

export const ClientBillingPage = () => {
  const { identity } = useGetIdentity();
  const location = useLocation();
  const hasInvoiceOpen = isBillingInvoiceWorkspace(
    location.pathname,
    location.search,
  );
  if (!identity) return null;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        hasInvoiceOpen
          ? "h-full flex-1 overflow-hidden"
          : "flex-1 gap-4 p-4 md:p-6",
      )}
    >
      <PageActions>
        <PageTitle label="Invoices" />
        <div className="ml-auto">
          <ModuleInfoPopover
            title={LBS_PLACEHOLDER_MODULES.billing.title}
            description={LBS_PLACEHOLDER_MODULES.billing.description}
          />
        </div>
      </PageActions>

      <ClientInvoicesTab />
    </div>
  );
};

/** @deprecated Use ClientBillingPage */
export const ClientBillingList = ClientBillingPage;
