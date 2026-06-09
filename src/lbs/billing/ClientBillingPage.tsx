import { useGetIdentity } from "ra-core";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { BillingRevenueChart } from "@/lbs/billing/BillingRevenueChart";
import { ClientInvoicesTab } from "@/lbs/billing/ClientInvoicesTab";
import { LBS_PLACEHOLDER_MODULES } from "@/lbs/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const ClientBillingPage = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <PageActions>
        <PageTitle label="Billing" />
        <div className="ml-auto">
          <ModuleInfoPopover
            title={LBS_PLACEHOLDER_MODULES.billing.title}
            description={LBS_PLACEHOLDER_MODULES.billing.description}
          />
        </div>
      </PageActions>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <ClientInvoicesTab />
        </TabsContent>

        <TabsContent value="revenue">
          <BillingRevenueChart />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/** @deprecated Use ClientBillingPage */
export const ClientBillingList = ClientBillingPage;
