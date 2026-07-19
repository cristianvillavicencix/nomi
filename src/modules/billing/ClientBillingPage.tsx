import { useGetIdentity } from "ra-core";
import { useLocation } from "react-router";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { ClientInvoicesTab } from "@/modules/billing/ClientInvoicesTab";
import { isBillingInvoiceWorkspace } from "@/modules/billing/billingWorkspaceMode";
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
          : "flex-1 gap-3",
      )}
    >
      <PageActions>
        <PageTitle label="Invoices" />
      </PageActions>

      <ClientInvoicesTab />
    </div>
  );
};

/** @deprecated Use ClientBillingPage */
export const ClientBillingList = ClientBillingPage;
