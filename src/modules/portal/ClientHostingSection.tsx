import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ClientCredentialsSection } from "@/modules/portal/ClientCredentialsSection";
import { ClientDomainSection } from "@/modules/portal/ClientDomainSection";
import { ClientServiceMapTable } from "@/modules/portal/ClientServiceMapTable";
import type { PortalCopy, PortalLocale } from "@/modules/portal/portalI18n";
import { PORTAL_HOSTING_CATEGORIES } from "@/modules/portal/portalCredentialCategories";
import { resolveNextMaintenanceDate } from "@/modules/portal/portalMaintenanceUtils";
import { readPortalHostingMeta } from "@/modules/portal/portalDeliveryMeta";
import {
  filterCredentialsByCategories,
  inferPrimaryHostingProvider,
} from "@/modules/portal/portalServiceMeta";
import {
  formatPortalDate,
  type PortalCredential,
  type PortalDelivery,
} from "@/modules/portal/portalTypes";

const InfoRow = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => {
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

const hostingStatusLabel = (status: string | null | undefined, copy: PortalCopy) => {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "active") return copy.hostingActive;
  if (normalized === "expired") return copy.hostingExpired;
  if (normalized === "pending") return copy.hostingPending;
  return status || "—";
};

export const ClientHostingSection = ({
  delivery,
  siteUrl,
  stagingUrl,
  credentials,
  portalToken,
  dealId,
  accountEmail,
  copy,
  locale,
}: {
  delivery: PortalDelivery;
  siteUrl?: string | null;
  stagingUrl?: string | null;
  credentials: PortalCredential[];
  portalToken: string;
  dealId: number;
  accountEmail?: string | null;
  copy: PortalCopy;
  locale: PortalLocale;
}) => {
  const localeTag = locale === "es" ? "es-US" : "en-US";
  const nextMaintenance = resolveNextMaintenanceDate(delivery);
  const hostingMeta = readPortalHostingMeta(delivery);
  const hostingCredentials = filterCredentialsByCategories(
    credentials,
    PORTAL_HOSTING_CATEGORIES,
  );
  const hostingProvider =
    inferPrimaryHostingProvider(credentials, siteUrl, delivery) ??
    copy.serviceProviderUnknown;
  const hostingManagedBy =
    hostingMeta.managed_by === "client"
      ? copy.managedByClient
      : hostingMeta.managed_by === "lbs"
        ? copy.managedByLbs
        : hostingCredentials.length === 0
          ? null
          : hostingCredentials.filter((entry) => entry.managed_by !== "client")
                .length >=
              hostingCredentials.length / 2
            ? copy.managedByLbs
            : copy.managedByClient;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          {copy.hostingSiteLocationTitle}
        </h2>
        <ClientDomainSection siteUrl={siteUrl} stagingUrl={stagingUrl} copy={copy} />
      </section>

      <section className="rounded-lg border bg-background/80">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            {copy.hostingProviderSectionTitle}
          </h2>
        </div>
        <dl className="px-4">
          <InfoRow label={copy.hostingProviderLabel} value={hostingProvider} />
          <InfoRow label={copy.managedByLabel} value={hostingManagedBy} />
          <InfoRow label={copy.hostingPanelUrlLabel} value={hostingMeta.panel_url} />
          <InfoRow label={copy.hostingLocationLabel} value={hostingMeta.location} />
          <InfoRow label={copy.plan} value={delivery.plan_name} />
          <InfoRow
            label={copy.hostingRenewal}
            value={formatPortalDate(delivery.hosting_renewal_date, localeTag)}
          />
          <InfoRow
            label={copy.hostingStatus}
            value={
              delivery.hosting_status ? (
                <Badge variant="outline" className="font-normal">
                  {hostingStatusLabel(delivery.hosting_status, copy)}
                </Badge>
              ) : null
            }
          />
          <InfoRow
            label={copy.nextMaintenance}
            value={
              nextMaintenance
                ? formatPortalDate(nextMaintenance, localeTag)
                : copy.nextMaintenanceUnknown
            }
          />
        </dl>
      </section>

      {hostingCredentials.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {copy.hostingServiceMapTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.hostingServiceMapIntro}
            </p>
          </div>
          <ClientServiceMapTable entries={hostingCredentials} copy={copy} />
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {copy.hostingCredentialsTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.hostingCredentialsIntro}
          </p>
        </div>
        <ClientCredentialsSection
          portalToken={portalToken}
          dealId={dealId}
          accountEmail={accountEmail}
          credentials={credentials}
          categories={PORTAL_HOSTING_CATEGORIES}
          emptyMessage={copy.noHostingCredentials}
          copy={copy}
          locale={locale}
        />
      </section>
    </div>
  );
};
