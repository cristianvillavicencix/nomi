import { Link } from "react-router";
import { ServiceCatalogSettings } from "@/modules/settings/ServiceCatalogSettings";

export const ProductsSettingsSection = () => (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Manage products and services under{" "}
      <Link
        to="/billing?tab=catalog"
        className="text-primary underline-offset-2 hover:underline"
      >
        Billing → Products & services
      </Link>
      . This settings view mirrors the same catalog.
    </p>
    <ServiceCatalogSettings />
  </div>
);
