import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { PortalCopy, PortalLocale } from "@/modules/portal/portalI18n";
import { resolveNextMaintenanceDate } from "@/modules/portal/portalMaintenanceUtils";
import {
  developmentDurationDays,
  formatPortalDate,
  type PortalDelivery,
} from "@/modules/portal/portalTypes";

const InfoRow = ({ label, value }: { label: string; value: ReactNode }) => {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex flex-col gap-1 border-b py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground sm:max-w-[60%] sm:text-right">
        {value}
      </dd>
    </div>
  );
};

export const ClientOverviewSection = ({
  delivery,
  copy,
  locale,
}: {
  delivery: PortalDelivery;
  copy: PortalCopy;
  locale: PortalLocale;
}) => {
  const localeTag = locale === "es" ? "es-US" : "en-US";
  const nextMaintenance = resolveNextMaintenanceDate(delivery);
  const devDays = developmentDurationDays(
    delivery.project_start_date,
    delivery.delivery_date ?? delivery.delivered_at,
  );
  const includedPages = (delivery.included_pages ?? []).filter(Boolean);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{copy.overviewIntro}</p>

      <section className="rounded-lg border bg-background/80">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            {copy.overviewProjectSection}
          </h2>
        </div>
        <dl className="px-4">
          <InfoRow label={copy.plan} value={delivery.plan_name} />
          <InfoRow
            label={copy.deliveryDate}
            value={formatPortalDate(
              delivery.delivery_date ?? delivery.delivered_at,
              localeTag,
            )}
          />
          <InfoRow label={copy.siteLanguage} value={delivery.site_language} />
          {devDays != null ? (
            <InfoRow
              label={copy.devDuration}
              value={`${devDays} ${copy.days}`}
            />
          ) : null}
          {includedPages.length > 0 ? (
            <InfoRow
              label={copy.includedPages}
              value={
                <span className="block text-left sm:text-right">
                  {includedPages.join(" · ")}
                </span>
              }
            />
          ) : null}
          <InfoRow
            label={copy.nextMaintenance}
            value={
              nextMaintenance ? (
                <span className="inline-flex flex-wrap items-center justify-end gap-2">
                  <span>{formatPortalDate(nextMaintenance, localeTag)}</span>
                  <Badge variant="secondary" className="font-normal">
                    {copy.nextMaintenanceBadge}
                  </Badge>
                </span>
              ) : (
                copy.nextMaintenanceUnknown
              )
            }
          />
        </dl>
      </section>

      <p className="text-sm text-muted-foreground">
        {copy.overviewNavigationHint}
      </p>
    </div>
  );
};
