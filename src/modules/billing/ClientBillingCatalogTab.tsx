import { ServiceCatalogSettings } from "@/modules/settings/ServiceCatalogSettings";

/** Products & services catalog inside the Billing hub. */
export const ClientBillingCatalogTab = () => (
  <div className="min-h-0 flex-1 overflow-y-auto pb-4">
    <ServiceCatalogSettings />
  </div>
);
