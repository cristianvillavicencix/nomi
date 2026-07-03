import { Link } from "react-router";
import { Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

export const MarketingSetupBanner = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { data: settings } = useQuery({
    queryKey: ["messaging-settings"],
    queryFn: () => dataProvider.getMessagingSettings(),
  });

  const hasSmsSender = Boolean(
    settings?.twilio_marketing_messaging_service_sid?.trim() ||
      settings?.twilio_marketing_phone_number?.trim(),
  );

  if (hasSmsSender) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        Marketing SMS sender is not configured yet. Add your Twilio Marketing
        Messaging Service in Settings before sending campaigns.
      </p>
      <Link
        to="/settings?tab=messaging"
        className="inline-flex shrink-0 items-center gap-1.5 font-medium text-foreground hover:underline"
      >
        <Settings className="size-4" />
        Settings → Communications
      </Link>
    </div>
  );
};
