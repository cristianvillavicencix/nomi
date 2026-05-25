import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PortalCopy } from "@/lbs/portal/portalI18n";
import { parseDomainFromUrl } from "@/lbs/portal/portalResourceUtils";
import { formatPortalDate, type PortalDomain } from "@/lbs/portal/portalTypes";

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-lg border bg-background/80 px-4 py-3">
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className="mt-1 text-sm font-medium text-[#0D3B6E]">{value}</div>
  </div>
);

export const ClientDomainSection = ({
  domains,
  siteUrl,
  copy,
  locale,
}: {
  domains: PortalDomain[];
  siteUrl?: string | null;
  copy: PortalCopy;
  locale: "es" | "en";
}) => {
  const localeTag = locale === "es" ? "es-US" : "en-US";
  const resolvedDomains =
    domains.length > 0
      ? domains
      : parseDomainFromUrl(siteUrl)
        ? [{ domain: parseDomainFromUrl(siteUrl) }]
        : [];

  if (resolvedDomains.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {copy.noDomainInfo}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{copy.domainIntro}</p>
      {resolvedDomains.map((domain) => (
        <div key={domain.id ?? domain.domain} className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-[#0D3B6E]">{domain.domain}</h3>
            <Badge variant="outline">
              {domain.managed_by === "client" ? copy.managedByClient : copy.managedByLbs}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <InfoRow label={copy.domainRegistrar} value={domain.registrar || "—"} />
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
              value={domain.auto_renew ? copy.yes : copy.no}
            />
          </div>
          {domain.dns_servers?.length ? (
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {copy.dnsServers}
              </div>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {domain.dns_servers.map((server) => (
                  <li key={server}>{server}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled>
              {copy.requestDomainTransfer}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled>
              {copy.reportDomainIssue}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
