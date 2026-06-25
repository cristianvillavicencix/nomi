import type { ReactNode } from "react";
import { ClientCredentialsSection } from "@/modules/portal/ClientCredentialsSection";
import { ClientServiceMapTable } from "@/modules/portal/ClientServiceMapTable";
import type { PortalCopy, PortalLocale } from "@/modules/portal/portalI18n";
import { PORTAL_DOMAIN_CATEGORIES } from "@/modules/portal/portalCredentialCategories";
import {
  filterCredentialsByCategories,
  inferPrimaryDomainRegistrar,
} from "@/modules/portal/portalServiceMeta";
import {
  formatPortalDate,
  type PortalCredential,
  type PortalDelivery,
  type PortalDomain,
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

export const ClientDomainPortalSection = ({
  delivery,
  domains = [],
  credentials,
  portalToken,
  dealId,
  accountEmail,
  copy,
  locale,
}: {
  delivery: PortalDelivery;
  domains?: PortalDomain[];
  credentials: PortalCredential[];
  portalToken: string;
  dealId: number;
  accountEmail?: string | null;
  copy: PortalCopy;
  locale: PortalLocale;
}) => {
  const localeTag = locale === "es" ? "es-US" : "en-US";
  const domainCredentials = filterCredentialsByCategories(
    credentials,
    PORTAL_DOMAIN_CATEGORIES,
  );
  const registrar =
    inferPrimaryDomainRegistrar(domains, credentials, delivery) ??
    copy.serviceProviderUnknown;

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">{copy.domainPortalIntro}</p>

      {domains.length > 0 ? (
        domains.map((domain) => (
          <section key={domain.domain} className="rounded-lg border bg-background/80">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {domain.domain}
              </h2>
            </div>
            <dl className="px-4">
              <InfoRow label={copy.domainRegistrar} value={domain.registrar ?? registrar} />
              <InfoRow
                label={copy.domainRegistered}
                value={formatPortalDate(domain.registered_at, localeTag)}
              />
              <InfoRow
                label={copy.domainRenewal}
                value={formatPortalDate(domain.renewal_date, localeTag)}
              />
              <InfoRow
                label={copy.domainAutoRenew}
                value={
                  domain.auto_renew == null
                    ? null
                    : domain.auto_renew
                      ? copy.yes
                      : copy.no
                }
              />
              <InfoRow
                label={copy.managedByLabel}
                value={
                  domain.managed_by === "client"
                    ? copy.managedByClient
                    : domain.managed_by === "lbs"
                      ? copy.managedByLbs
                      : domain.managed_by
                }
              />
              {domain.dns_servers && domain.dns_servers.length > 0 ? (
                <InfoRow
                  label={copy.dnsServers}
                  value={
                    <span className="block font-mono text-xs">
                      {domain.dns_servers.join(" · ")}
                    </span>
                  }
                />
              ) : null}
            </dl>
          </section>
        ))
      ) : (
        <section className="rounded-lg border bg-background/80">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              {copy.overviewDomainSection}
            </h2>
          </div>
          <dl className="px-4">
            <InfoRow label={copy.domainRegistrar} value={registrar} />
          </dl>
        </section>
      )}

      {domainCredentials.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {copy.domainServiceMapTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.domainServiceMapIntro}
            </p>
          </div>
          <ClientServiceMapTable entries={domainCredentials} copy={copy} />
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {copy.domainCredentialsTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.domainCredentialsIntro}
          </p>
        </div>
        <ClientCredentialsSection
          portalToken={portalToken}
          dealId={dealId}
          accountEmail={accountEmail}
          credentials={credentials}
          categories={PORTAL_DOMAIN_CATEGORIES}
          emptyMessage={copy.noDomainCredentials}
          copy={copy}
          locale={locale}
        />
      </section>
    </div>
  );
};
