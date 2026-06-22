import { useGetIdentity } from "ra-core";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { ClientInvoicesTab } from "@/modules/billing/ClientInvoicesTab";
import { LBS_PLACEHOLDER_MODULES } from "@/app/navigation";

export const ClientBillingPage = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
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
