import { ServiceCatalogSettings } from "@/lbs/settings/ServiceCatalogSettings";
import { ContractTermsSettings } from "@/lbs/settings/ContractTermsSettings";
import {
  CLIENT_BILLING_MODES,
} from "@/lbs/proposals/proposalCommercialConstants";
import { isClientBillingSkipped } from "@/lbs/billing/clientBillingProvider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const CommercialSettingsSection = () => (
  <div className="space-y-8 max-w-5xl">
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Client billing mode</CardTitle>
        <CardDescription>
          Stripe integration is prepared but optional during development.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 text-sm">
        {CLIENT_BILLING_MODES.map((mode) => (
          <Badge
            key={mode.value}
            variant={mode.value === "manual" ? "default" : "outline"}
          >
            {mode.label}
          </Badge>
        ))}
        {isClientBillingSkipped() ? (
          <Badge variant="secondary">VITE_SKIP_CLIENT_BILLING active</Badge>
        ) : null}
      </CardContent>
    </Card>

    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Service catalog
      </h2>
      <ServiceCatalogSettings />
    </div>

    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Contract terms
      </h2>
      <ContractTermsSettings />
    </div>
  </div>
);
