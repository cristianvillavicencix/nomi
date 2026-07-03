import { CLIENT_BILLING_MODES } from "@/modules/proposals/proposalCommercialConstants";
import { isClientBillingSkipped } from "@/modules/billing/clientBillingProvider";
import { Badge } from "@/components/ui/badge";

export const BillingSettingsSection = () => (
  <div className="flex flex-wrap items-center gap-2 text-sm">
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
  </div>
);
